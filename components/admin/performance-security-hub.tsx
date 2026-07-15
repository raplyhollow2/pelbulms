'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  Database,
  Globe,
  Lock,
  Key,
  FileText,
  BarChart3,
  Settings,
  RefreshCw,
  Download,
  Upload,
  Clock,
  Server,
  Code,
  Eye,
  EyeOff,
  Ban,
  ShieldAlert,
  Bug,
  TestTube
} from 'lucide-react'

interface PerformanceMetrics {
  response_time: number
  throughput: number
  error_rate: number
  uptime: number
  memory_usage: number
  cpu_usage: number
  active_users: number
  database_connections: number
  cache_hit_rate: number
  average_load_time: number
}

interface SecurityMetrics {
  total_incidents: number
  blocked_attacks: number
  active_sessions: number
  failed_login_attempts: number
  password_resets: number
  security_score: number
  last_audit: string
  vulnerabilities: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

interface SecurityLog {
  id: string
  timestamp: string
  type: 'auth' | 'access' | 'suspicious' | 'system'
  severity: 'info' | 'warning' | 'critical'
  event: string
  details: string
  user?: string
  ip?: string
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down'
  services: {
    database: 'operational' | 'degraded' | 'down'
    api: 'operational' | 'degraded' | 'down'
    storage: 'operational' | 'degraded' | 'down'
    cdn: 'operational' | 'degraded' | 'down'
    auth: 'operational' | 'degraded' | 'down'
  }
  uptime: number
  last_restart: string
}

export function PerformanceSecurityHub() {
  const [activeTab, setActiveTab] = useState<'performance' | 'security' | 'logs' | 'health'>('performance')
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null)
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')

  useEffect(() => {
    fetchPerformanceMetrics()
    fetchSecurityMetrics()
    fetchSecurityLogs()
    fetchSystemHealth()

    if (isMonitoring) {
      const interval = setInterval(() => {
        fetchPerformanceMetrics()
        fetchSecurityMetrics()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [isMonitoring, refreshInterval])

  const fetchPerformanceMetrics = async () => {
    // Mock performance data
    setPerformanceMetrics({
      response_time: 142,
      throughput: 1250,
      error_rate: 0.02,
      uptime: 99.95,
      memory_usage: 68,
      cpu_usage: 45,
      active_users: 1234,
      database_connections: 85,
      cache_hit_rate: 94,
      average_load_time: 1.2
    })
  }

  const fetchSecurityMetrics = async () => {
    // Mock security data
    setSecurityMetrics({
      total_incidents: 23,
      blocked_attacks: 156,
      active_sessions: 89,
      failed_login_attempts: 12,
      password_resets: 5,
      security_score: 87,
      last_audit: '2025-07-10',
      vulnerabilities: {
        critical: 0,
        high: 1,
        medium: 3,
        low: 7
      }
    })
  }

  const fetchSecurityLogs = async () => {
    // Mock security logs
    const mockLogs: SecurityLog[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        type: 'auth',
        severity: 'info',
        event: 'User Login',
        details: 'Successful login from IP 192.168.1.1',
        user: 'user@example.com',
        ip: '192.168.1.1'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'suspicious',
        severity: 'warning',
        event: 'Multiple Failed Attempts',
        details: '5 failed login attempts from IP 10.0.0.1',
        ip: '10.0.0.1'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        type: 'access',
        severity: 'info',
        event: 'API Access',
        details: 'GET /api/courses - 200 OK',
        user: 'api-service'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: 'system',
        severity: 'critical',
        event: 'Rate Limit Exceeded',
        details: 'API rate limit exceeded for user@example.com',
        user: 'user@example.com'
      }
    ]
    setSecurityLogs(mockLogs)
  }

  const fetchSystemHealth = async () => {
    // Mock health data
    setSystemHealth({
      status: 'healthy',
      services: {
        database: 'operational',
        api: 'operational',
        storage: 'operational',
        cdn: 'operational',
        auth: 'operational'
      },
      uptime: 99.95,
      last_restart: '2025-07-08T06:30:00Z'
    })
  }

  const runSecurityAudit = async () => {
    // Simulate security audit
    await new Promise(resolve => setTimeout(resolve, 2000))
    fetchSecurityMetrics()
  }

  const exportSecurityLogs = () => {
    const logs = securityLogs.map(log => ({
      timestamp: log.timestamp,
      type: log.type,
      severity: log.severity,
      event: log.event,
      details: log.details,
      user: log.user,
      ip: log.ip
    }))

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `security-logs-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'warning': return 'default'
      case 'info': return 'secondary'
      default: return 'outline'
    }
  }

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const filteredLogs = selectedSeverity === 'all'
    ? securityLogs
    : securityLogs.filter(log => log.severity === selectedSeverity)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Performance & Security Hub</h2>
          <p className="text-gray-600 dark:text-gray-400">Monitor system performance and security metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {isMonitoring ? 'Monitoring' : 'Paused'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            fetchPerformanceMetrics()
            fetchSecurityMetrics()
            fetchSecurityLogs()
            fetchSystemHealth()
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">
            <Zap className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="w-4 h-4 mr-2" />
            Health
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {performanceMetrics && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{performanceMetrics.response_time}ms</div>
                    <p className="text-xs text-green-500 mt-1">
                      <TrendingDown className="w-3 h-3 inline mr-1" />
                      12% improvement
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{performanceMetrics.throughput}/s</div>
                    <p className="text-xs text-gray-500 mt-1">Requests per second</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{performanceMetrics.error_rate}%</div>
                    <p className="text-xs text-green-500 mt-1">Within target</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{performanceMetrics.uptime}%</div>
                    <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Resource Usage</CardTitle>
                    <CardDescription>Current system resource consumption</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Memory Usage</span>
                        <span className="text-sm font-medium">{performanceMetrics.memory_usage}%</span>
                      </div>
                      <Progress value={performanceMetrics.memory_usage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">CPU Usage</span>
                        <span className="text-sm font-medium">{performanceMetrics.cpu_usage}%</span>
                      </div>
                      <Progress value={performanceMetrics.cpu_usage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Database Connections</span>
                        <span className="text-sm font-medium">{performanceMetrics.database_connections}/100</span>
                      </div>
                      <Progress value={(performanceMetrics.database_connections / 100) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Activity</CardTitle>
                    <CardDescription>Active user statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span>Active Users</span>
                      </div>
                      <span className="text-2xl font-bold">{performanceMetrics.active_users}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-green-600" />
                        <span>Cache Hit Rate</span>
                      </div>
                      <span className="text-2xl font-bold">{performanceMetrics.cache_hit_rate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-600" />
                        <span>Avg Load Time</span>
                      </div>
                      <span className="text-2xl font-bold">{performanceMetrics.average_load_time}s</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Targets</CardTitle>
                  <CardDescription>Lighthouse scores and optimization metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-5 gap-4">
                    {[
                      { name: 'Performance', score: 96, target: 95 },
                      { name: 'Accessibility', score: 98, target: 95 },
                      { name: 'Best Practices', score: 94, target: 90 },
                      { name: 'SEO', score: 97, target: 95 },
                      { name: 'PWA', score: 92, target: 90 }
                    ].map(metric => (
                      <div key={metric.name} className="text-center">
                        <div className={`text-3xl font-bold ${
                          metric.score >= metric.target ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {metric.score}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{metric.name}</p>
                        <p className="text-xs text-gray-400">Target: {metric.target}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          {securityMetrics && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {securityMetrics.security_score}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Excellent</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Blocked Attacks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{securityMetrics.blocked_attacks}</div>
                    <p className="text-xs text-green-500 mt-1">This month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{securityMetrics.active_sessions}</div>
                    <p className="text-xs text-gray-500 mt-1">Currently active</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{securityMetrics.failed_login_attempts}</div>
                    <p className="text-xs text-yellow-500 mt-1">Last 24 hours</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Vulnerability Scanner</CardTitle>
                    <CardDescription>Security vulnerabilities by severity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-600" />
                          <span className="text-sm">Critical</span>
                        </div>
                        <Badge variant={securityMetrics.vulnerabilities.critical > 0 ? "destructive" : "secondary"}>
                          {securityMetrics.vulnerabilities.critical}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <span className="text-sm">High</span>
                        </div>
                        <Badge variant={securityMetrics.vulnerabilities.high > 0 ? "default" : "secondary"}>
                          {securityMetrics.vulnerabilities.high}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bug className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm">Medium</span>
                        </div>
                        <Badge variant="secondary">
                          {securityMetrics.vulnerabilities.medium}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Low</span>
                        </div>
                        <Badge variant="outline">
                          {securityMetrics.vulnerabilities.low}
                        </Badge>
                      </div>
                    </div>
                    <Button className="w-full mt-4" onClick={runSecurityAudit}>
                      <Shield className="w-4 h-4 mr-2" />
                      Run Security Audit
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Security Metrics</CardTitle>
                    <CardDescription>Authentication and access controls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Password Resets</span>
                      </div>
                      <span className="font-medium">{securityMetrics.password_resets}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        <span className="text-sm">Security Incidents</span>
                      </div>
                      <span className="font-medium">{securityMetrics.total_incidents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Last Audit</span>
                      </div>
                      <span className="font-medium">{securityMetrics.last_audit}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-green-600" />
                        <span className="text-sm">RLS Policies</span>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Logs</CardTitle>
                  <CardDescription>Real-time security event monitoring</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={exportSecurityLogs}>
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Badge variant={getSeverityColor(log.severity) as any} className="mt-1">
                          {log.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{log.event}</p>
                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                            {log.user && <span>User: {log.user}</span>}
                            {log.ip && <span>IP: {log.ip}</span>}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{log.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          {systemHealth && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Overall system status and service availability</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`text-3xl font-bold ${
                      systemHealth.status === 'healthy' ? 'text-green-600' :
                      systemHealth.status === 'degraded' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">Overall system status</p>
                      <p className="text-xs text-gray-500">Last updated: {new Date().toLocaleString()}</p>
                    </div>
                    <Badge variant={systemHealth.status === 'healthy' ? "secondary" : "destructive"}>
                      {systemHealth.uptime}% uptime
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-5 gap-4">
                    {Object.entries(systemHealth.services).map(([service, status]) => (
                      <div key={service} className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${getServiceStatusColor(status)}`}>
                          {status === 'operational' ? '●' : status === 'degraded' ? '◐' : '○'}
                        </div>
                        <p className="text-sm mt-2 capitalize">{service}</p>
                        <p className="text-xs text-gray-500 capitalize">{status}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Dependencies</CardTitle>
                  <CardDescription>External services and integrations status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { name: 'Supabase Database', status: 'operational', latency: '12ms' },
                      { name: 'Supabase Storage', status: 'operational', latency: '45ms' },
                      { name: 'AI API (OpenAI)', status: 'operational', latency: '234ms' },
                      { name: 'Cloudinary CDN', status: 'operational', latency: '89ms' },
                      { name: 'Vercel Edge', status: 'operational', latency: '8ms' },
                      { name: 'Auth Providers', status: 'operational', latency: '156ms' }
                    ].map(service => (
                      <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            service.status === 'operational' ? 'bg-green-600' : 'bg-red-600'
                          }`} />
                          <span className="font-medium">{service.name}</span>
                        </div>
                        <div className="text-sm text-gray-500">{service.latency}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                  <CardDescription>Environment and deployment details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Environment</span>
                        <span className="font-medium">Production</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Version</span>
                        <span className="font-medium">2.1.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Deployment</span>
                        <span className="font-medium">Vercel</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Region</span>
                        <span className="font-medium">US East</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Node Version</span>
                        <span className="font-medium">v18.17.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Framework</span>
                        <span className="font-medium">Next.js 16.2.10</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Last Restart</span>
                        <span className="font-medium">{new Date(systemHealth.last_restart).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Uptime</span>
                        <span className="font-medium">{systemHealth.uptime}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}