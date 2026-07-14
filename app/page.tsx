'use client'

import { BookOpen, Users, Award, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-white dark:from-gray-900 dark:to-black">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {/* Logo & Brand */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-strong">
              <BookOpen className="w-8 h-8 text-bhutan-yellow" />
              <span className="text-2xl font-bold bg-gradient-to-r from-bhutan-yellow to-bhutan-orange bg-clip-text text-transparent">
                Pelbu LMS
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Advanced Learning for
              <span className="block mt-2 bg-gradient-to-r from-bhutan-yellow via-bhutan-orange to-bhutan-red bg-clip-text text-transparent">
                Modern Bhutan
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Empowering 500+ students across institutions with AI-powered learning,
              real-time collaboration, and modern education experiences.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="min-h-[56px] px-8 text-lg bg-bhutan-yellow hover:bg-bhutan-orange transition-colors touch-feedback"
              onClick={() => router.push('/auth/login')}
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-[56px] px-8 text-lg border-2 touch-feedback"
              onClick={() => router.push('/about')}
            >
              Learn More
            </Button>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-8">
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-bhutan-yellow">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Active Students</div>
            </div>
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-bhutan-orange">50+</div>
              <div className="text-sm text-muted-foreground mt-1">Expert Teachers</div>
            </div>
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-bhutan-red">100+</div>
              <div className="text-sm text-muted-foreground mt-1">Courses</div>
            </div>
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-green-600">24/7</div>
              <div className="text-sm text-muted-foreground mt-1">AI Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-xl text-muted-foreground">Everything you need for modern education</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-bhutan-yellow/20 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-bhutan-yellow" />
              </div>
              <CardTitle>AI-Powered Learning</CardTitle>
              <CardDescription>
                24/7 AI tutor with personalized learning paths and instant feedback
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 2 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-bhutan-orange/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-bhutan-orange" />
              </div>
              <CardTitle>Real-time Collaboration</CardTitle>
              <CardDescription>
                Live classrooms, interactive discussions, and group projects
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 3 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-bhutan-red/20 flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-bhutan-red" />
              </div>
              <CardTitle>Smart Assessments</CardTitle>
              <CardDescription>
                AI-powered auto-grading with detailed feedback and analytics
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 4 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Geo-fenced Attendance</CardTitle>
              <CardDescription>
                PIN-based attendance with optional GPS verification
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 5 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>4-Method Course Creation</CardTitle>
              <CardDescription>
                Rich text, markdown, forms, or AI - choose your workflow
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 6 */}
          <Card className="glass hover:shadow-xl transition-all duration-300 touch-feedback">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Mobile-First Design</CardTitle>
              <CardDescription>
                Apple-inspired glassmorphism with offline capabilities
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="glass-strong rounded-3xl p-12 text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to Transform Your Learning?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of students and teachers experiencing the future of education in Bhutan
          </p>
          <Button
            size="lg"
            className="min-h-[56px] px-12 text-lg bg-bhutan-yellow hover:bg-bhutan-orange transition-colors touch-feedback"
            onClick={() => router.push('/auth/login')}
          >
            Start Learning Today
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2025 Pelbu LMS. Empowering Education in Bhutan.</p>
            <p className="mt-2 text-sm">Built by <a href="https://www.linkedin.com/in/rajiv-pradhan" target="_blank" rel="noopener noreferrer" className="text-bhutan-yellow hover:text-bhutan-orange transition-colors">Rajiv Pradhan</a> using Next.js 15 + Supabase + AI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}