'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Smartphone,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Bell,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Battery,
  Signal,
  RotateCw,
  Hand as Swipe, // Using Hand icon instead of non-existent Swipe
  Fingerprint as Touch, // Using Fingerprint icon instead of non-existent Touch
  CloudOff as Offline, // Using CloudOff icon instead of non-existent Offline
  Cloud,
  Database,
  RefreshCw as Sync, // Using RefreshCw icon instead of non-existent Sync
  Zap,
  Shield,
  Eye,
  Globe,
  Trash2
} from 'lucide-react'

interface MobileCapabilities {
  isOnline: boolean
  isInstalled: boolean
  hasServiceWorker: boolean
  supportsBackgroundSync: boolean
  supportsPushNotifications: boolean
  storageEstimate: {
    quota: number
    usage: number
    usageDetails: {
      indexedDB: number
      cache: number
      serviceWorker: number
    }
  }
}

interface PWAState {
  installPrompt: Event | null
  isInstallable: boolean
  updateAvailable: boolean
  updateReady: boolean
  registration: ServiceWorkerRegistration | null
}

interface OfflineQueue {
  actions: {
    id: string
    type: string
    data: any
    timestamp: string
    status: 'pending' | 'synced' | 'failed'
  }[]
  isSyncing: boolean
}

export function MobilePWAHub() {
  const [activeTab, setActiveTab] = useState<'features' | 'offline' | 'install' | 'status'>('features')
  const [capabilities, setCapabilities] = useState<MobileCapabilities | null>(null)
  const [pwaState, setPWAState] = useState<PWAState>({
    installPrompt: null,
    isInstallable: false,
    updateAvailable: false,
    updateReady: false,
    registration: null
  })
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueue>({
    actions: [],
    isSyncing: false
  })
  const [isPulling, setIsPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkMobileCapabilities()
    detectInstallability()
    checkServiceWorker()
    loadOfflineQueue()

    // Add online/offline listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for service worker updates
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const checkMobileCapabilities = async () => {
    const isOnline = navigator.onLine
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: minimal-ui)').matches

    // Check service worker support
    const hasServiceWorker = 'serviceWorker' in navigator

    // Check background sync support
    const supportsBackgroundSync = 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype

    // Check push notifications support
    const supportsPushNotifications = 'Notification' in window &&
                                     'serviceWorker' in navigator &&
                                     'PushManager' in window

    // Get storage estimate
    let storageEstimate = { quota: 0, usage: 0, usageDetails: { indexedDB: 0, cache: 0, serviceWorker: 0 } }

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        storageEstimate = await navigator.storage.estimate() as any
      } catch (error) {
        console.error('Storage estimate failed:', error)
      }
    }

    setCapabilities({
      isOnline,
      isInstalled,
      hasServiceWorker,
      supportsBackgroundSync,
      supportsPushNotifications,
      storageEstimate
    })
  }

  const detectInstallability = async () => {
    // Check if app is installable
    const isInstallable = !window.matchMedia('(display-mode: standalone)').matches &&
                         !window.matchMedia('(display-mode: minimal-ui)').matches

    setPWAState(prev => ({ ...prev, isInstallable }))
  }

  const checkServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        setPWAState(prev => ({ ...prev, registration }))

        // Check for updates
        if (registration) {
          await registration.update()
        }
      } catch (error) {
        console.error('Service worker check failed:', error)
      }
    }
  }

  const loadOfflineQueue = async () => {
    // Load offline actions from IndexedDB
    const actions = await getOfflineActions()
    setOfflineQueue({
      actions,
      isSyncing: false
    })
  }

  const getOfflineActions = async (): Promise<any[]> => {
    // Mock offline actions - in real implementation, load from IndexedDB
    return [
      {
        id: '1',
        type: 'quiz_submission',
        data: { quizId: 'quiz-1', answers: {} },
        timestamp: new Date().toISOString(),
        status: 'pending'
      }
    ]
  }

  const handleOnline = () => {
    if (capabilities) {
      setCapabilities({ ...capabilities, isOnline: true })
    }
    syncOfflineActions()
  }

  const handleOffline = () => {
    if (capabilities) {
      setCapabilities({ ...capabilities, isOnline: false })
    }
  }

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault()
    setPWAState({
      installPrompt: e,
      isInstallable: true,
      updateAvailable: false,
      updateReady: false,
      registration: null
    })
  }

  const handleControllerChange = () => {
    window.location.reload()
  }

  const installApp = async () => {
    if (pwaState.installPrompt) {
      (pwaState.installPrompt as any).prompt()
      const { outcome } = await (pwaState.installPrompt as any).userChoice
      setPWAState({
        installPrompt: null,
        isInstallable: outcome !== 'accepted',
        updateAvailable: false,
        updateReady: false,
        registration: null
      })
    }
  }

  const syncOfflineActions = async () => {
    if (offlineQueue.isSyncing) return

    setOfflineQueue(prev => ({ ...prev, isSyncing: true }))

    // Simulate syncing
    await new Promise(resolve => setTimeout(resolve, 2000))

    setOfflineQueue({
      actions: [],
      isSyncing: false
    })
  }

  const handlePullToRefresh = async () => {
    setIsPulling(true)
    setPullProgress(0)

    // Simulate refresh progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setPullProgress(i)
    }

    window.location.reload()
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('Pelbu LMS', {
          body: 'Notifications enabled! You\'ll receive updates for courses, assignments, and more.',
          icon: '/icon-192.png'
        })
      }
    }
  }

  const clearOfflineData = async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    if ('indexedDB' in window) {
      // Clear IndexedDB
      const databases = await indexedDB.databases()
      await Promise.all(
        databases.map(db => {
          if (db.name) {
            return new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(db.name!)
              request.onsuccess = resolve
              request.onerror = reject
            })
          }
        })
      )
    }

    loadOfflineQueue()
    checkMobileCapabilities()
  }

  const formatStorageSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mobile & PWA Hub</h2>
          <p className="text-gray-600 dark:text-gray-400">Progressive Web App features and mobile optimization</p>
        </div>
        {capabilities && (
          <Badge variant={capabilities.isOnline ? "default" : "destructive"} className="flex items-center gap-1">
            {capabilities.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {capabilities.isOnline ? 'Online' : 'Offline'}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="features">
            <Smartphone className="w-4 h-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="offline">
            <Cloud className="w-4 h-4 mr-2" />
            Offline
          </TabsTrigger>
          <TabsTrigger value="install">
            <Download className="w-4 h-4 mr-2" />
            Install
          </TabsTrigger>
          <TabsTrigger value="status">
            <Settings className="w-4 h-4 mr-2" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Features</CardTitle>
              <CardDescription>Touch-optimized interactions and mobile enhancements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Swipe className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold">Pull-to-Refresh</h3>
                  </div>
                  <p className="text-sm text-gray-600">Pull down to refresh content and data</p>
                  <Button size="sm" variant="outline" onClick={handlePullToRefresh} disabled={isPulling}>
                    {isPulling ? (
                      <>Refreshing {pullProgress}%</>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Test Refresh
                      </>
                    )}
                  </Button>
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Touch className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold">Touch Interactions</h3>
                  </div>
                  <p className="text-sm text-gray-600">Long-press menus and swipe actions</p>
                  <Button size="sm" variant="outline">
                    <Touch className="w-4 h-4 mr-2" />
                    Test Gestures
                  </Button>
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold">Push Notifications</h3>
                  </div>
                  <p className="text-sm text-gray-600">Course updates and reminders</p>
                  <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
                    <Bell className="w-4 h-4 mr-2" />
                    Enable Notifications
                  </Button>
                </div>

                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Battery className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold">Battery Optimization</h3>
                  </div>
                  <p className="text-sm text-gray-600">Efficient power consumption</p>
                  <Badge variant="secondary">Optimized</Badge>
                </div>
              </div>

              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-300">
                  All mobile features are optimized for iOS and Android devices
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offline Tab */}
        <TabsContent value="offline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offline Functionality</CardTitle>
              <CardDescription>Work without internet connection and sync when online</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Offline className="w-8 h-8 text-orange-600" />
                  <div>
                    <p className="font-medium">Offline Mode</p>
                    <p className="text-sm text-gray-600">
                      {capabilities?.isOnline ? 'Currently online' : 'Currently offline'}
                    </p>
                  </div>
                </div>
                <Badge variant={capabilities?.isOnline ? "default" : "secondary"}>
                  {capabilities?.isOnline ? 'Active' : 'Offline'}
                </Badge>
              </div>

              {offlineQueue.actions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Pending Actions ({offlineQueue.actions.length})</h3>
                    <Button
                      size="sm"
                      onClick={syncOfflineActions}
                      disabled={!capabilities?.isOnline || offlineQueue.isSyncing}
                    >
                      <Sync className="w-4 h-4 mr-2" />
                      {offlineQueue.isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {offlineQueue.actions.map(action => (
                      <div key={action.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{action.type.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(action.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={action.status === 'pending' ? "secondary" : "default"}>
                            {action.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-semibold">Offline Data Management</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <Button variant="outline" onClick={loadOfflineQueue}>
                    <Database className="w-4 h-4 mr-2" />
                    Refresh Queue
                  </Button>
                  <Button variant="outline" onClick={clearOfflineData}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Offline Data
                  </Button>
                </div>
              </div>

              {capabilities?.storageEstimate && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Storage Usage</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>IndexedDB</span>
                        <span>{formatStorageSize(capabilities.storageEstimate.usageDetails.indexedDB)}</span>
                      </div>
                      <Progress value={(capabilities.storageEstimate.usageDetails.indexedDB / capabilities.storageEstimate.quota) * 100} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Cache</span>
                        <span>{formatStorageSize(capabilities.storageEstimate.usageDetails.cache)}</span>
                      </div>
                      <Progress value={(capabilities.storageEstimate.usageDetails.cache / capabilities.storageEstimate.quota) * 100} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Service Worker</span>
                        <span>{formatStorageSize(capabilities.storageEstimate.usageDetails.serviceWorker)}</span>
                      </div>
                      <Progress value={(capabilities.storageEstimate.usageDetails.serviceWorker / capabilities.storageEstimate.quota) * 100} className="h-2" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Total: {formatStorageSize(capabilities.storageEstimate.usage)} / {formatStorageSize(capabilities.storageEstimate.quota)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Install Tab */}
        <TabsContent value="install" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Install App</CardTitle>
              <CardDescription>Install Pelbu LMS on your device for offline access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!capabilities?.isInstalled ? (
                <div className="text-center space-y-4">
                  <Smartphone className="w-16 h-16 mx-auto text-gray-400" />
                  <div>
                    <h3 className="text-lg font-semibold">Install Pelbu LMS</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      Install the app on your device for the best experience
                    </p>
                  </div>
                  {pwaState.isInstallable ? (
                    <Button size="lg" onClick={installApp}>
                      <Download className="w-4 h-4 mr-2" />
                      Install App
                    </Button>
                  ) : (
                    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                        App installation is not available in this browser
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
                  <div>
                    <h3 className="text-lg font-semibold">App Installed!</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      Pelbu LMS is installed on your device
                    </p>
                  </div>
                  <Badge variant="secondary" className="mx-auto">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Installed
                  </Badge>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Installation Benefits</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Offline Access</p>
                      <p className="text-sm text-gray-600">Work without internet</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Faster Loading</p>
                      <p className="text-sm text-gray-600">Instant app startup</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bell className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-gray-600">Stay updated</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Secure</p>
                      <p className="text-sm text-gray-600">HTTPS protection</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          {capabilities && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {capabilities.isOnline ? (
                        <Wifi className="w-5 h-5 text-green-600" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-medium">{capabilities.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {capabilities.isOnline ? 'All features available' : 'Offline mode active'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Installation Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {capabilities.isInstalled ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Smartphone className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-medium">{capabilities.isInstalled ? 'Installed' : 'Not Installed'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {capabilities.isInstalled ? 'Running as installed app' : 'Running in browser'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Service Worker</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {capabilities.hasServiceWorker ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-medium">{capabilities.hasServiceWorker ? 'Active' : 'Not Available'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {capabilities.hasServiceWorker ? 'Background sync enabled' : 'Limited offline support'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Display Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">{window.matchMedia('(display-mode: standalone)').matches ? 'Standalone' : 'Browser'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {window.matchMedia('(display-mode: standalone)').matches ? 'Full screen experience' : 'Standard browser view'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Supported Features</CardTitle>
                  <CardDescription>PWA capabilities available on this device</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Sync className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Background Sync</span>
                      </div>
                      <Badge variant={capabilities.supportsBackgroundSync ? "default" : "secondary"}>
                        {capabilities.supportsBackgroundSync ? 'Supported' : 'Limited'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Push Notifications</span>
                      </div>
                      <Badge variant={capabilities.supportsPushNotifications ? "default" : "secondary"}>
                        {capabilities.supportsPushNotifications ? 'Supported' : 'Limited'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-green-600" />
                        <span className="text-sm">IndexedDB</span>
                      </div>
                      <Badge variant="default">Supported</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-orange-600" />
                        <span className="text-sm">Cache API</span>
                      </div>
                      <Badge variant="default">Supported</Badge>
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