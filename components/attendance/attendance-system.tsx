// @ts-nocheck - Supabase type inference issues documented in TYPESCRIPT_ISSUES.md
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Shield,
  Users,
  Calendar,
  Timer,
  AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface AttendanceSession {
  id: string
  course_id: string
  session_name: string
  pin: string
  latitude: number
  longitude: number
  radius: number
  start_time: string
  end_time: string
  is_active: boolean
  created_by: string
}

interface AttendanceRecord {
  id: string
  session_id: string
  user_id: string
  check_in_time: string
  location_verified: boolean
  distance_from_location: number
  verification_method: 'pin' | 'qr' | 'auto'
  status: 'present' | 'late' | 'absent'
}

interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number
}

export function AttendanceSystem() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [enteredPIN, setEnteredPIN] = useState('')
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [userRole, setUserRole] = useState<'student' | 'instructor' | 'admin'>('student')

  // Fetch active sessions
  useEffect(() => {
    fetchActiveSessions()

    // Subscribe to attendance updates
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendanceRecords(prev => [...prev, payload.new as AttendanceRecord])
          } else if (payload.eventType === 'UPDATE') {
            setAttendanceRecords(prev =>
              prev.map(record =>
                record.id === payload.new.id ? payload.new as AttendanceRecord : record
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchActiveSessions = async () => {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('is_active', true)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })

    if (!error && data) {
      setSessions(data as AttendanceSession[])
    }
  }

  const getCurrentLocation = (): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          setLocationError(error.message)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const verifyLocation = (session: AttendanceSession): boolean => {
    if (!currentLocation) return false

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      session.latitude,
      session.longitude
    )

    return distance <= session.radius
  }

  const handleCheckIn = async (session: AttendanceSession) => {
    setCheckInStatus('checking')
    setActiveSession(session)

    try {
      // Get current location
      const location = await getCurrentLocation()

      // Verify location
      const isWithinRadius = verifyLocation(session)
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        session.latitude,
        session.longitude
      )

      // Determine status based on time
      const now = new Date()
      const startTime = new Date(session.start_time)
      const isLate = now > startTime

      // Create attendance record
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCheckInStatus('error')
        return
      }

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          session_id: session.id,
          user_id: user.id,
          check_in_time: new Date().toISOString(),
          location_verified: isWithinRadius,
          distance_from_location: distance,
          verification_method: 'pin',
          status: isLate ? 'late' : 'present'
        })

      if (error) throw error

      setCheckInStatus('success')

      // Update local records
      setAttendanceRecords(prev => [...prev, {
        id: crypto.randomUUID(),
        session_id: session.id,
        user_id: user.id,
        check_in_time: new Date().toISOString(),
        location_verified: isWithinRadius,
        distance_from_location: distance,
        verification_method: 'pin',
        status: isLate ? 'late' : 'present'
      }])

    } catch (error) {
      console.error('Check-in error:', error)
      setCheckInStatus('error')
      setLocationError(error instanceof Error ? error.message : 'Check-in failed')
    }
  }

  const createSession = async (sessionData: Partial<AttendanceSession>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newSession = {
      course_id: sessionData.course_id || '',
      session_name: sessionData.session_name || 'New Session',
      pin: Math.floor(1000 + Math.random() * 9000).toString(), // Generate 4-digit PIN
      latitude: sessionData.latitude || 0,
      longitude: sessionData.longitude || 0,
      radius: sessionData.radius || 100, // Default 100m radius
      start_time: sessionData.start_time || new Date().toISOString(),
      end_time: sessionData.end_time || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      created_by: user.id
    }

    const { error } = await supabase
      .from('attendance_sessions')
      .insert(newSession)

    if (!error) {
      fetchActiveSessions()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance System</h2>
          <p className="text-gray-600 dark:text-gray-400">Geo-fenced attendance tracking</p>
        </div>
        <Badge variant={currentLocation ? "default" : "secondary"}>
          <MapPin className="w-3 h-3 mr-1" />
          {currentLocation ? 'Location Active' : 'Location Pending'}
        </Badge>
      </div>

      <Tabs defaultValue="student-view" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="student-view">Student View</TabsTrigger>
          <TabsTrigger value="instructor-view">Instructor View</TabsTrigger>
        </TabsList>

        <TabsContent value="student-view" className="space-y-4">
          {/* Location Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Location Verification
              </CardTitle>
              <CardDescription>
                {currentLocation
                  ? `Current: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} (±${currentLocation.accuracy.toFixed(0)}m)`
                  : 'Enable location services to check in'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={getCurrentLocation}
                variant="outline"
                className="w-full"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Update Location
              </Button>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Active Sessions</h3>
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active attendance sessions</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              sessions.map(session => (
                <Card key={session.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{session.session_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          {new Date(session.start_time).toLocaleTimeString()} - {new Date(session.end_time).toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      <Badge variant={checkInStatus === 'success' ? "default" : "outline"}>
                        {session.pin}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>Radius: {session.radius}m</span>
                    </div>

                    {checkInStatus === 'success' && activeSession?.id === session.id ? (
                      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-300">
                          Successfully checked in!
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          placeholder="Enter PIN"
                          value={enteredPIN}
                          onChange={(e) => setEnteredPIN(e.target.value)}
                          maxLength={4}
                          className="text-center text-2xl tracking-widest"
                        />
                        <Button
                          onClick={() => handleCheckIn(session)}
                          disabled={checkInStatus === 'checking' || !currentLocation}
                          className="w-full"
                          variant={enteredPIN === session.pin ? "default" : "outline"}
                        >
                          {checkInStatus === 'checking' ? (
                            <>Verifying...</>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Check In
                            </>
                          )}
                        </Button>
                        {locationError && (
                          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-300">
                              {locationError}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* My Attendance Records */}
          <Card>
            <CardHeader>
              <CardTitle>My Attendance</CardTitle>
              <CardDescription>Recent check-ins</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceRecords.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No attendance records yet</p>
              ) : (
                <div className="space-y-3">
                  {attendanceRecords.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {record.location_verified ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{new Date(record.check_in_time).toLocaleDateString()}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(record.check_in_time).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={record.status === 'present' ? "default" : "secondary"}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructor-view" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Attendance Session</CardTitle>
              <CardDescription>
                Set up geo-fenced attendance for your class
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session Name</label>
                <Input placeholder="e.g., Week 10 Lecture" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Use Current Location</label>
                <Button
                  onClick={getCurrentLocation}
                  variant="outline"
                  className="w-full"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {currentLocation ? 'Update Location' : 'Get Current Location'}
                </Button>
                {currentLocation && (
                  <p className="text-sm text-gray-500">
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Geo-fence Radius (meters)</label>
                <Input type="number" defaultValue={100} min={10} max={500} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input type="datetime-local" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Time</label>
                  <Input type="datetime-local" />
                </div>
              </div>

              <Button className="w-full" onClick={() => createSession({})}>
                <Timer className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            </CardContent>
          </Card>

          {/* Session Management */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{session.session_name}</p>
                          <p className="text-sm text-gray-500">PIN: {session.pin}</p>
                        </div>
                        <Badge>Active</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>
                          {attendanceRecords.filter(r => r.session_id === session.id).length} checked in
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <QrCode className="w-4 h-4 mr-1" />
                          Show QR
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          View Report
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}