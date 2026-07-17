# Closed Institutional LMS Implementation Plan

## 🎯 Overview
Convert the current open-access Pelbu LMS into a **closed institutional system** exclusively for Pelsung, where only approved students can access learning content.

---

## 🔍 Current Problem Analysis

### Current Open System (BROKEN)
```
Google Sign Up → Instant Access → Enroll in Any Course → Start Learning
❌ Anyone with Google ID can join
❌ No approval required
❌ No institution restrictions
❌ No teacher assignment control
```

### Required Closed System
```
Google Sign Up → Pending Status → Show "Pending Approval" Page →
dipanpradhan.biz@gmail.com Manually Approves → Full Access → Start Learning
✅ Manual approval required
✅ Pending approval page for unapproved users
✅ dipanpradhan.biz@gmail.com as institution admin
✅ Institution-based access control
```

---

## 🗄️ Database Schema Changes

### 1. User Approval System Tables

**New Migration: `supabase/migrations/023_user_approval_system.sql`**

```sql
-- User approval workflow table
CREATE TABLE user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id),
  requested_by UUID REFERENCES profiles(id),
  approval_status VARCHAR(20) CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  notes TEXT
);

-- Institution-specific access control
CREATE TABLE institution_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_within_institution VARCHAR(50) CHECK (role_within_institution IN ('student', 'teacher', 'admin', 'resource_person')),
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(institution_id, user_id)
);

-- Enhanced institution table
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS
  signup_approval_required BOOLEAN DEFAULT true,
  allowed_email_domains TEXT[] DEFAULT NULL,
  max_students INTEGER DEFAULT NULL,
  resource_person_id UUID REFERENCES profiles(id);

-- Enhanced profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  account_status VARCHAR(20) CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')) DEFAULT 'pending',
  institution_id UUID REFERENCES institutions(id),
  enrollment_date TIMESTAMP WITH TIME ZONE,
  last_approval_check TIMESTAMP WITH TIME ZONE;

-- Performance indexes
CREATE INDEX idx_user_approvals_status ON user_approvals(approval_status, institution_id);
CREATE INDEX idx_institution_access_user ON institution_access(user_id, institution_id);
CREATE INDEX idx_profiles_status ON profiles(account_status, institution_id);
```

### 2. Set Up Pelsung Institution

```sql
-- Set Pelsung as default institution and assign resource person
UPDATE institutions
SET
  signup_approval_required = true,
  resource_person_id = (SELECT id FROM profiles WHERE email = 'dipanpradhan.biz@gmail.com')
WHERE slug = 'pelsung';

-- Ensure dipanpradhan.biz@gmail.com has resource_person role
UPDATE profiles
SET
  account_status = 'active',
  institution_id = (SELECT id FROM institutions WHERE slug = 'pelsung'),
  role = 'resource_person'
WHERE email = 'dipanpradhan.biz@gmail.com';

-- Grant institution access
INSERT INTO institution_access (
  institution_id,
  user_id,
  role_within_institution,
  granted_by,
  is_active
) VALUES (
  (SELECT id FROM institutions WHERE slug = 'pelsung'),
  (SELECT id FROM profiles WHERE email = 'dipanpradhan.biz@gmail.com'),
  'resource_person',
  (SELECT id FROM profiles WHERE email = 'dipanpradhan.biz@gmail.com'),
  true
);
```

---

## 🔐 Authentication Flow Changes

### 1. Enhanced OAuth Callback

**File: `app/auth/callback/route.ts`**

```typescript
export async function GET(request: Request) {
  const { supabase } = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Check if user exists in profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status, institution_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Create pending profile for new user
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata.full_name || '',
      avatar_url: user.user_metadata.avatar_url || null,
      account_status: 'pending'
    })

    // Create approval request
    await supabase.from('user_approvals').insert({
      user_id: user.id,
      institution_id: (await getInstitutionId('pelsung')),
      approval_status: 'pending'
    })

    return NextResponse.redirect(new URL('/auth/pending-approval', request.url))
  }

  // Check account status and route accordingly
  if (profile.account_status === 'pending') {
    return NextResponse.redirect(new URL('/auth/pending-approval', request.url))
  }

  if (profile.account_status === 'rejected') {
    return NextResponse.redirect(new URL('/auth/access-denied', request.url))
  }

  // Approved user - continue to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### 2. Pending Approval Page

**File: `app/auth/pending-approval/page.tsx`**

```typescript
export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 glass-card">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-bhutan-yellow/20 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-bhutan-yellow animate-pulse" />
          </div>
          <CardTitle>Account Pending Approval</CardTitle>
          <CardDescription>
            Your account requires approval from the institution administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            You will receive an email notification once your account has been reviewed.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This LMS is exclusively for Pelsung institution members.
              Registration requires manual verification.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/auth/logout'}
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. Enhanced Middleware Protection

**File: `middleware.ts`**

```typescript
export async function middleware(request: NextRequest) {
  const { supabase } = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const protectedRoutes = ['/dashboard', '/courses', '/learn', '/teach']
  const adminRoutes = ['/admin', '/teach']

  for (const path of protectedRoutes) {
    if (request.nextUrl.pathname.startsWith(path)) {
      if (!session) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }

      // Check approval status
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status, institution_id, role')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.account_status !== 'active') {
        return NextResponse.redirect(new URL('/auth/pending-approval', request.url))
      }

      // Role-based access control
      if (request.nextUrl.pathname.startsWith('/teach')) {
        if (profile.role !== 'instructor' && profile.role !== 'admin' && profile.role !== 'resource_person') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      }

      break
    }
  }

  return NextResponse.next()
}
```

---

## 👨‍💼 Resource Person Dashboard

### 1. User Approval Interface

**File: `app/admin/approvals/page.tsx`**

```typescript
export default function UserApprovalsPage() {
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('user_approvals')
      .select('*, profiles(full_name, email, avatar_url, created_at)')
      .eq('approval_status', 'pending')
      .order('requested_at', { ascending: true })

    setPendingApprovals(data || [])
    setLoading(false)
  }

  const handleApproval = async (userId: string, action: 'approve' | 'reject', reason?: string) => {
    const supabase = createClient()

    if (action === 'approve') {
      // Update user status to active
      await supabase
        .from('profiles')
        .update({
          account_status: 'active',
          institution_id: (await getInstitutionId('pelsung')),
          enrollment_date: new Date().toISOString()
        })
        .eq('id', userId)

      // Add institution access as student
      await supabase
        .from('institution_access')
        .insert({
          institution_id: (await getInstitutionId('pelsung')),
          user_id: userId,
          role_within_institution: 'student'
        })

      // Update approval record
      await supabase
        .from('user_approvals')
        .update({
          approval_status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user.id
        })
        .eq('user_id', userId)

      // Send approval email
      await sendApprovalEmail(userId)

    } else {
      // Reject user
      await supabase
        .from('profiles')
        .update({ account_status: 'rejected' })
        .eq('id', userId)

      await supabase
        .from('user_approvals')
        .update({
          approval_status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user.id,
          rejection_reason: reason
        })
        .eq('user_id', userId)

      await sendRejectionEmail(userId, reason)
    }

    fetchPendingApprovals()
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="glass-card mb-6">
        <CardHeader>
          <CardTitle>Pending User Approvals</CardTitle>
          <CardDescription>
            Review and approve student registration requests for Pelsung institution
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {pendingApprovals.map((approval) => (
          <Card key={approval.id} className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar src={approval.profiles?.avatar_url} />
                  <div>
                    <h3 className="font-semibold">{approval.profiles?.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{approval.profiles?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested: {new Date(approval.requested_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApproval(approval.user_id, 'approve')}
                    className="bg-bhutan-yellow hover:bg-bhutan-orange"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleApproval(approval.user_id, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 2. Teacher Assignment Interface

**File: `app/admin/teachers/page.tsx`**

```typescript
export default function TeacherManagementPage() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedCourses, setSelectedCourses] = useState([])

  useEffect(() => {
    fetchActiveUsers()
    fetchInstitutionCourses()
  }, [])

  const assignTeacherRole = async (userId: string, courseIds: string[]) => {
    const supabase = createClient()

    // Update institution access to teacher role
    await supabase
      .from('institution_access')
      .upsert({
        institution_id: (await getInstitutionId('pelsung')),
        user_id: userId,
        role_within_institution: 'teacher',
        granted_by: (await supabase.auth.getUser()).data.user.id
      })

    // Assign selected courses to teacher
    for (const courseId of courseIds) {
      await supabase
        .from('institution_course_assignments')
        .insert({
          institution_id: (await getInstitutionId('pelsung')),
          course_id: courseId,
          assigned_teacher_id: userId,
          assigned_by: (await supabase.auth.getUser()).data.user.id
        })
    }

    alert(`Teacher role and course assignments completed for ${selectedUser.full_name}`)
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Teacher Assignment</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Selection */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Select User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.filter(u => u.account_status === 'active').map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3 rounded cursor-pointer ${selectedUser?.id === user.id ? 'bg-bhutan-yellow/20' : 'hover:bg-muted'}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={user.avatar_url} />
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <Badge>{user.role || 'Student'}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course Assignment */}
        {selectedUser && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Assign Courses</CardTitle>
              <CardDescription>
                Select courses for {selectedUser.full_name} to teach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={institutionCourses}
                selected={selectedCourses}
                onChange={setSelectedCourses}
                placeholder="Select courses to assign..."
              />
              <Button
                onClick={() => assignTeacherRole(selectedUser.id, selectedCourses)}
                className="mt-4 w-full bg-bhutan-yellow hover:bg-bhutan-orange"
              >
                Assign as Teacher
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

---

## 🎯 Institution-Based Access Control

### 1. Course Catalog Filtering

**File: `app/courses/page.tsx`**

```typescript
const fetchCourses = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Show only published courses without enrollment info
    const { data: courses } = await supabase
      .from('courses')
      .select('*, profiles(full_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    setCourses(courses || [])
    return
  }

  // Get user's institution and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id, role, role_within_institution')
    .eq('id', user.id)
    .single()

  // Filter courses by institution
  const { data: courses } = await supabase
    .from('courses')
    .select('*, profiles(full_name, avatar_url)')
    .eq('is_published', true)
    .eq('institution_id', profile?.institution_id) // Institution filter
    .order('created_at', { ascending: false })

  setCourses(courses || [])
}

const handleEnroll = async (courseId: string) => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    window.location.href = '/auth/login'
    return
  }

  // Check if user is active and belongs to institution
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status, institution_id, role_within_institution')
    .eq('id', user.id)
    .single()

  if (!profile || profile.account_status !== 'active') {
    alert('Your account is pending approval. Please wait for administrator approval.')
    return
  }

  // Check if course belongs to user's institution
  const { data: course } = await supabase
    .from('courses')
    .select('institution_id')
    .eq('id', courseId)
    .single()

  if (course?.institution_id !== profile.institution_id) {
    alert('You can only enroll in courses from your institution.')
    return
  }

  // Proceed with enrollment
  try {
    await supabase.from('enrollments').insert({
      user_id: user.id,
      course_id: courseId,
      status: 'active',
      progress_percentage: 0
    })

    alert('Successfully enrolled!')
    window.location.href = `/learn/${courseId}`
  } catch (error) {
    alert('Failed to enroll. Please try again.')
  }
}
```

### 2. Update Main Navigation

**File: `app/(dashboard)/layout.tsx`**

```typescript
const getNavigationItems = (userRole: string, userStatus: string) => {
  // Hide navigation for pending users
  if (userStatus !== 'active') {
    return [
      { title: 'Home', href: '/', icon: Home },
    ]
  }

  const baseItems = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Courses', href: '/courses', icon: BookOpen },
  ]

  if (userRole === 'student') {
    return [
      ...baseItems,
      { title: 'My Learning', href: '/learn', icon: GraduationCap },
    ]
  }

  if (userRole === 'instructor') {
    return [
      ...baseItems,
      { title: 'Teach', href: '/teach', icon: GraduationCap },
      { title: 'My Students', href: '/students', icon: Users },
    ]
  }

  if (userRole === 'resource_person' || userRole === 'admin') {
    return [
      ...baseItems,
      { title: 'Teach', href: '/teach', icon: GraduationCap },
      { title: 'Approvals', href: '/admin/approvals', icon: UserCheck },
      { title: 'Teachers', href: '/admin/teachers', icon: UserPlus },
      { title: 'Settings', href: '/admin/settings', icon: Settings },
    ]
  }

  return baseItems
}
```

---

## 📧 Email Notification System

**File: `lib/email/approval-notifications.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApprovalEmail(userId: string) {
  const supabase = createClient()

  const { data: user } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  if (!user) return

  await resend.emails.send({
    from: 'Pelsung LMS <noreply@pelsung.edu.bt>',
    to: user.email,
    subject: 'Your Pelsung LMS Account Has Been Approved',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFC72C;">Welcome to Pelsung Learning Management System</h2>
        <p>Dear ${user.full_name},</p>
        <p>Your account has been approved and you now have access to the Pelsung LMS.</p>
        <a href="https://pelbulms.vercel.app/login" style="display: inline-block; padding: 12px 24px; background: #FFC72C; color: #000; text-decoration: none; border-radius: 8px;">Access LMS</a>
        <p>If you have any questions, please contact: dipanpradhan.biz@gmail.com</p>
        <p>Best regards,<br>Pelsung Administration</p>
      </div>
    `
  })
}

export async function sendRejectionEmail(userId: string, reason: string) {
  const supabase = createClient()

  const { data: user } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  if (!user) return

  await resend.emails.send({
    from: 'Pelsung LMS <noreply@pelsung.edu.bt>',
    to: user.email,
    subject: 'Regarding Your Pelsung LMS Application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Pelsung LMS Application Update</h2>
        <p>Dear ${user.full_name},</p>
        <p>Unfortunately, we are unable to approve your application at this time.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you believe this is an error, please contact: dipanpradhan.biz@gmail.com</p>
      </div>
    `
  })
}
```

---

## 🚀 Implementation Priority

### Phase 1: Database Foundation (CRITICAL - Day 1)
1. **Create migration 023_user_approval_system.sql**
2. **Set up Pelsung institution** with dipanpradhan.biz@gmail.com as resource person
3. **Update TypeScript types** from new schema
4. **Test database functions and constraints**

### Phase 2: Authentication Flow (Day 2-3)
1. **Modify auth callback** to check approval status
2. **Create pending approval page** (app/auth/pending-approval/page.tsx)
3. **Update middleware** for status-based routing
4. **Test complete signup flow**

### Phase 3: Admin Dashboard (Day 3-4)
1. **Build user approval interface** (app/admin/approvals/page.tsx)
2. **Create teacher assignment system** (app/admin/teachers/page.tsx)
3. **Add email notification system**
4. **Test approval workflow end-to-end**

### Phase 4: Access Control (Day 4-5)
1. **Update course catalog** with institution filtering
2. **Add enrollment restrictions**
3. **Implement role-based navigation**
4. **Test all access control points**

### Phase 5: Testing & Deployment (Day 5-6)
1. **Test complete signup → approval → access flow**
2. **Test teacher assignment workflow**
3. **Test course access control**
4. **Fix TypeScript error in login page** (haptic.warning issue)
5. **Deploy to production**

---

## 🛠️ Files to Create/Modify

### New Files:
1. `app/auth/pending-approval/page.tsx` - Pending approval UI
2. `app/auth/access-denied/page.tsx` - Rejected user page
3. `app/admin/approvals/page.tsx` - User approval dashboard
4. `app/admin/teachers/page.tsx` - Teacher assignment interface
5. `lib/email/approval-notifications.ts` - Email notifications
6. `supabase/migrations/023_user_approval_system.sql` - Database migration

### Files to Modify:
1. `app/auth/callback/route.ts` - Enhanced OAuth callback with approval check
2. `app/auth/login/page.tsx` - Fix TypeScript error with haptic.warning
3. `middleware.ts` - Status-based routing protection
4. `app/courses/page.tsx` - Institution-filtered course catalog
5. `app/(dashboard)/layout.tsx` - Role-based navigation
6. `types/database.types.ts` - Updated TypeScript types

---

## ✅ Success Criteria

### Functional Requirements
- ✅ New Google signups create "pending" accounts (not active)
- ✅ Pending users see approval page, not full dashboard access
- ✅ dipanpradhan.biz@gmail.com can approve/reject users
- ✅ Approved users get full access to Pelsung courses only
- ✅ Teacher assignment system works correctly
- ✅ Email notifications sent for approvals

### Technical Requirements
- ✅ Database migration runs without errors
- ✅ All RLS policies enforce institution boundaries
- ✅ Middleware correctly blocks unapproved access
- ✅ TypeScript compiles without errors (fix haptic.warning)
- ✅ No breaking changes to existing approved users

### Security Requirements
- ✅ No way to bypass approval system
- ✅ Institution isolation enforced at database level
- ✅ Role-based access control working correctly
- ✅ Audit trail for all approvals

---

This plan transforms your LMS from an open platform to a **secure, closed institutional system** where Pelsung (through dipanpradhan.biz@gmail.com) has complete control over user access and role assignments.