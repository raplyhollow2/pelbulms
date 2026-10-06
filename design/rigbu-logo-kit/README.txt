RIGBU LOGO KIT — v1 (mark, icons and character)
================================================

WEB APP  (put the web/ files in your site's /public folder)
  favicon-16x16.png, favicon-32x32.png, favicon-48x48.png  browser tab icons
  favicon.svg                 sharp tab icon for modern browsers
  apple-touch-icon.png        iPhone/iPad "Add to Home Screen" (180x180)
  android-chrome-192x192.png  PWA / web manifest icon
  android-chrome-512x512.png  PWA / web manifest icon
  maskable-icon-512x512.png   PWA icon, "purpose": "maskable" in the manifest

  Next.js: in app/layout.tsx metadata ->
    icons: { icon: [{url:'/favicon-32x32.png',sizes:'32x32'},{url:'/favicon.svg',type:'image/svg+xml'}],
             apple: '/apple-touch-icon.png' }
  Manifest theme_color / background_color: #1B2433

MOBILE APP
  ios/AppIcon-1024.png                 App Store icon (no transparency; iOS rounds the corners)
  android/play-store-512.png           Google Play listing icon
  android/adaptive-foreground-432.png  adaptive icon foreground layer (mark sits in the safe zone)
  android/adaptive-background-432.png  adaptive icon background layer (solid #1B2433)
  android/adaptive-monochrome-432.png  Android 13+ themed icon
  splash/splash-1290x2796.png          full splash screen (iPhone Pro Max size)
  splash/splash-mark-512.png           centred splash image; set splash background to #1B2433
  (Expo/React Native: icon = AppIcon-1024.png; splash image = splash-mark-512.png, backgroundColor #1B2433)

LOGO MARK  (logo/, transparent background)
  rigbu-mark-on-light-*.png   for white / cream backgrounds
  rigbu-mark-on-dark-*.png    for dark navy backgrounds
  rigbu-mark-simple-*.png     no face — for very small or embroidered/printed use
  rigbu-mark-mono-ink / -mono-white   one-colour versions (stamps, certificates, watermarks)
  .svg versions               use these on the website wherever possible (always sharp)

CHARACTER  (character/, transparent background)
  rigbu-character-on-dark / -on-light   hero illustration (landing page, about page)
  rigbu-hello       welcome / sign-in screen
  rigbu-thinking    loading, empty states, "no courses yet"
  rigbu-celebrate   lesson complete, certificate issued

COLOURS
  Gold   #F5B82E   head / glow
  Ember  #E8743B   left leaf, flame tip
  Pine   #2F6B4F   right leaf on light backgrounds
  Mint   #6FC79A   right leaf on dark backgrounds
  Ink    #1B2433   text, dark backgrounds
  Paper  #FAF7F2   light backgrounds

WORDMARK
  Typeface: Plus Jakarta Sans ExtraBold (800), lowercase "rigbu", letter-spacing -0.045em, colour Ink.
  Full lockups (mark + "rigbu") follow in v2.
