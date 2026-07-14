'use client'

import { useEffect, useState } from 'react'

export function ServiceWorkerRegistration() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope)
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }

    // Handle before install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('PWA installation accepted')
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-bhutan-yellow text-white p-4 rounded-lg shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold mb-1">Install Pelbu LMS</p>
            <p className="text-sm opacity-90 mb-3">
              Install our app for the best experience and offline access
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-white text-bhutan-yellow px-4 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="bg-transparent border border-white px-4 py-2 rounded-lg font-semibold hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowInstallPrompt(false)}
            className="text-white hover:opacity-70"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}