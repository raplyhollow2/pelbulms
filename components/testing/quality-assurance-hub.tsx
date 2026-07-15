'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  TestTube,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bug,
  Shield,
  Eye,
  Settings,
  Play,
  Pause,
  RefreshCw,
  FileText,
  BarChart3,
  Activity,
  Zap,
  Clock,
  Users,
  Code,
  Globe,
  Smartphone,
  Monitor,
  Wrench,
  Download,
  Upload,
  Search,
  Filter,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

interface TestSuite {
  id: string
  name: string
  type: 'unit' | 'integration' | 'e2e' | 'visual' | 'performance'
  tests: number
  passed: number
  failed: number
  skipped: number
  duration: number
  lastRun: string
  status: 'passed' | 'failed' | 'running' | 'pending'
}

interface TestCase {
  id: string
  name: string
  suite: string
  status: 'passed' | 'failed' | 'skipped' | 'running'
  duration: number
  error?: string
  lastRun: string
}

interface QualityMetric {
  category: string
  metric: string
  value: number
  target: number
  status: 'passing' | 'failing' | 'warning'
  trend: 'up' | 'down' | 'stable'
}

interface TestCoverage {
  statements: number
  branches: number
  functions: number
  lines: number
}

interface AccessibilityReport {
  score: number
  issues: {
    critical: number
    serious: number
    moderate: number
    minor: number
  }
  wcagLevel: 'A' | 'AA' | 'AAA'
}

export function QualityAssuranceHub() {
  const [activeTab, setActiveTab] = useState<'tests' | 'coverage' | 'performance' | 'accessibility'>('tests')
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetric[]>([])
  const [coverage, setCoverage] = useState<TestCoverage | null>(null)
  const [a11yReport, setA11yReport] = useState<AccessibilityReport | null>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)

  useEffect(() => {
    fetchTestData()
    fetchQualityMetrics()
    fetchCoverageData()
    fetchAccessibilityReport()
  }, [])

  const fetchTestData = async () => {
    // Mock test data
    const suites: TestSuite[] = [
      {
        id: 'unit-tests',
        name: 'Unit Tests',
        type: 'unit',
        tests: 245,
        passed: 238,
        failed: 5,
        skipped: 2,
        duration: 12.5,
        lastRun: new Date().toISOString(),
        status: 'failed'
      },
      {
        id: 'integration-tests',
        name: 'Integration Tests',
        type: 'integration',
        tests: 89,
        passed: 87,
        failed: 1,
        skipped: 1,
        duration: 45.2,
        lastRun: new Date().toISOString(),
        status: 'failed'
      },
      {
        id: 'e2e-tests',
        name: 'E2E Tests',
        type: 'e2e',
        tests: 34,
        passed: 32,
        failed: 2,
        skipped: 0,
        duration: 180.0,
        lastRun: new Date().toISOString(),
        status: 'failed'
      },
      {
        id: 'visual-tests',
        name: 'Visual Regression',
        type: 'visual',
        tests: 56,
        passed: 56,
        failed: 0,
        skipped: 0,
        duration: 67.8,
        lastRun: new Date().toISOString(),
        status: 'passed'
      },
      {
        id: 'performance-tests',
        name: 'Performance Tests',
        type: 'performance',
        tests: 23,
        passed: 22,
        failed: 1,
        skipped: 0,
        duration: 34.2,
        lastRun: new Date().toISOString(),
        status: 'failed'
      }
    ]

    const cases: TestCase[] = [
      {
        id: '1',
        name: 'User authentication flow',
        suite: 'integration-tests',
        status: 'passed',
        duration: 2.3,
        lastRun: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Course creation validation',
        suite: 'integration-tests',
        status: 'failed',
        duration: 1.8,
        error: 'AssertionError: Expected title to be required',
        lastRun: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Video player controls',
        suite: 'e2e-tests',
        status: 'failed',
        duration: 45.2,
        error: 'TimeoutError: Element not found after 30s',
        lastRun: new Date().toISOString()
      }
    ]

    setTestSuites(suites)
    setTestCases(cases)
  }

  const fetchQualityMetrics = async () => {
    const metrics: QualityMetric[] = [
      { category: 'Performance', metric: 'Lighthouse Score', value: 96, target: 95, status: 'passing', trend: 'up' },
      { category: 'Performance', metric: 'First Contentful Paint', value: 1.2, target: 1.5, status: 'passing', trend: 'down' },
      { category: 'Code Quality', metric: 'TypeScript Coverage', value: 94, target: 90, status: 'passing', trend: 'up' },
      { category: 'Code Quality', metric: 'ESLint Rules', value: 98, target: 95, status: 'passing', trend: 'stable' },
      { category: 'Security', metric: 'Security Score', value: 87, target: 85, status: 'passing', trend: 'up' },
      { category: 'Security', metric: 'Vulnerability Count', value: 3, target: 0, status: 'warning', trend: 'down' },
      { category: 'Testing', metric: 'Test Coverage', value: 88, target: 80, status: 'passing', trend: 'up' },
      { category: 'Accessibility', metric: 'WCAG Compliance', value: 92, target: 90, status: 'passing', trend: 'stable' }
    ]
    setQualityMetrics(metrics)
  }

  const fetchCoverageData = async () => {
    setCoverage({
      statements: 88.5,
      branches: 82.3,
      functions: 91.2,
      lines: 87.8
    })
  }

  const fetchAccessibilityReport = async () => {
    setA11yReport({
      score: 92,
      issues: {
        critical: 0,
        serious: 2,
        moderate: 5,
        minor: 8
      },
      wcagLevel: 'AA'
    })
  }

  const runTestSuite = async (suiteId: string) => {
    setIsRunningTests(true)
    setTestSuites(prev => prev.map(suite =>
      suite.id === suiteId ? { ...suite, status: 'running' } : suite
    ))

    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 3000))

    setTestSuites(prev => prev.map(suite => {
      if (suite.id === suiteId) {
        const passed = suite.tests - suite.failed - Math.floor(Math.random() * 3)
        return {
          ...suite,
          passed,
          failed: suite.tests - passed - suite.skipped,
          status: passed === suite.tests ? 'passed' : 'failed',
          lastRun: new Date().toISOString()
        }
      }
      return suite
    }))

    setIsRunningTests(false)
  }

  const runAllTests = async () => {
    setIsRunningTests(true)
    setTestSuites(prev => prev.map(suite => ({ ...suite, status: 'running' })))

    // Simulate running all tests
    await new Promise(resolve => setTimeout(resolve, 5000))

    setTestSuites(prev => prev.map(suite => ({
      ...suite,
      status: Math.random() > 0.2 ? 'passed' : 'failed',
      lastRun: new Date().toISOString()
    })))

    setIsRunningTests(false)
  }

  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'running': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'passing': return 'text-green-600'
      case 'failing': return 'text-red-600'
      case 'warning': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const exportTestReport = () => {
    const report = {
      testSuites,
      testCases,
      qualityMetrics,
      coverage,
      a11yReport,
      generatedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quality Assurance Hub</h2>
          <p className="text-gray-600 dark:text-gray-400">Testing, monitoring, and quality metrics</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runAllTests}
            disabled={isRunningTests}
          >
            {isRunningTests ? (
              <>Running...</>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run All Tests
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={exportTestReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tests">
            <TestTube className="w-4 h-4 mr-2" />
            Tests
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <Code className="w-4 h-4 mr-2" />
            Coverage
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Zap className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="accessibility">
            <Eye className="w-4 h-4 mr-2" />
            A11y
          </TabsTrigger>
        </TabsList>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="grid md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {testSuites.reduce((sum, suite) => sum + suite.tests, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Passed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {testSuites.reduce((sum, suite) => sum + suite.passed, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {testSuites.reduce((sum, suite) => sum + suite.failed, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Skipped</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">
                  {testSuites.reduce((sum, suite) => sum + suite.skipped, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {testSuites.reduce((sum, suite) => sum + suite.duration, 0).toFixed(1)}s
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Test Suites</CardTitle>
              <CardDescription>Overview of all test suites and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testSuites.map(suite => (
                  <div key={suite.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          suite.status === 'passed' ? 'bg-green-600' :
                          suite.status === 'failed' ? 'bg-red-600' :
                          suite.status === 'running' ? 'bg-blue-600 animate-pulse' :
                          'bg-gray-400'
                        }`} />
                        <div>
                          <p className="font-medium">{suite.name}</p>
                          <p className="text-xs text-gray-500">
                            {suite.tests} tests • {suite.duration.toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{suite.type}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runTestSuite(suite.id)}
                          disabled={isRunningTests}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{suite.passed} passed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span>{suite.failed} failed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span>{suite.skipped} skipped</span>
                      </div>
                      <div className="text-gray-500">
                        {new Date(suite.lastRun).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedSuite && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Test Cases</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setSelectedSuite(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {testCases
                    .filter(tc => tc.suite === selectedSuite)
                    .map(testCase => (
                      <div key={testCase.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {testCase.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                              {testCase.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                              {testCase.status === 'skipped' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                              <span className="font-medium">{testCase.name}</span>
                            </div>
                            {testCase.error && (
                              <p className="text-sm text-red-600 mt-1">{testCase.error}</p>
                            )}
                          </div>
                          <Badge variant={testCase.status === 'passed' ? 'secondary' : 'destructive'}>
                            {testCase.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          {coverage && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Statements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coverage.statements}%</div>
                    <Progress value={coverage.statements} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Branches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coverage.branches}%</div>
                    <Progress value={coverage.branches} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Functions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coverage.functions}%</div>
                    <Progress value={coverage.functions} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Lines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coverage.lines}%</div>
                    <Progress value={coverage.lines} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Coverage by Module</CardTitle>
                  <CardDescription>Detailed breakdown of code coverage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { module: 'components', coverage: 92, files: 45 },
                      { module: 'lib', coverage: 88, files: 23 },
                      { module: 'app', coverage: 85, files: 67 },
                      { module: 'utils', coverage: 94, files: 12 }
                    ].map(item => (
                      <div key={item.module}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{item.module}</span>
                          <span className="text-sm text-gray-500">{item.coverage}% ({item.files} files)</span>
                        </div>
                        <Progress value={item.coverage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {qualityMetrics
              .filter(m => m.category === 'Performance')
              .map(metric => (
                <Card key={metric.metric}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{metric.metric}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{metric.value}{metric.metric.includes('Score') ? '' : 's'}</div>
                        <p className="text-xs text-gray-500">Target: {metric.target}{metric.metric.includes('Score') ? '' : 's'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {metric.trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-600" /> :
                         metric.trend === 'down' ? <TrendingDown className="w-4 h-4 text-green-600" /> :
                         <Activity className="w-4 h-4 text-gray-600" />}
                        <Badge variant={metric.status === 'passing' ? 'secondary' : 'destructive'}>
                          {metric.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lighthouse Scores</CardTitle>
              <CardDescription>Performance metrics across different categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-4">
                {[
                  { name: 'Performance', score: 96 },
                  { name: 'Accessibility', score: 98 },
                  { name: 'Best Practices', score: 94 },
                  { name: 'SEO', score: 97 },
                  { name: 'PWA', score: 92 }
                ].map(category => (
                  <div key={category.name} className="text-center">
                    <div className={`text-3xl font-bold ${
                      category.score >= 90 ? 'text-green-600' :
                      category.score >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {category.score}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{category.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-4">
          {a11yReport && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">A11y Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{a11yReport.score}</div>
                    <p className="text-xs text-gray-500 mt-1">Out of 100</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">WCAG Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{a11yReport.wcagLevel}</div>
                    <p className="text-xs text-gray-500 mt-1">Compliance level</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {a11yReport.issues.critical +
                       a11yReport.issues.serious +
                       a11yReport.issues.moderate +
                       a11yReport.issues.minor}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{a11yReport.issues.critical}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Issue Breakdown</CardTitle>
                  <CardDescription>Distribution of accessibility issues by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-medium">Critical</span>
                      </div>
                      <Badge variant="destructive">{a11yReport.issues.critical}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span className="font-medium">Serious</span>
                      </div>
                      <Badge variant="default">{a11yReport.issues.serious}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="font-medium">Moderate</span>
                      </div>
                      <Badge variant="secondary">{a11yReport.issues.moderate}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Minor</span>
                      </div>
                      <Badge variant="outline">{a11yReport.issues.minor}</Badge>
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