# Rigbu Brand Kit v2 — the owl

The Rigbu owl is an original mascot. Its wings are the two leaves of the first Rigbu mark (ember and pine), and it
holds the gold **light of wisdom** on its chest. The same light is the dot of the "i" in the custom `rigbu` wordmark.
Tagline used in the social image: **Learn anywhere. Light the way.**

v2 replaces the logo and app icons from v1. Open `previews/` first to see everything.

---

## 1. Logo — `logo/`
| File | Use |
|---|---|
| `rigbu-logo-horizontal-light.svg` / `-dark.svg` | **Main logo.** Website header and footer. Use `-dark` on dark backgrounds |
| `rigbu-logo-stacked-light.svg` / `-dark.svg` | Square spaces, posters, certificate header |
| `rigbu-mark-light.svg` / `-dark.svg` | Owl only: avatars, small header on mobile, watermark |
| `rigbu-logo-horizontal-mono-ink` / `-mono-white` | One colour: stamps, embossing, photocopies, partner logos rows |
| `rigbu-mark-mono-ink` / `-mono-white` | One-colour owl: certificate seal, watermark |
| `rigbu-wordmark-ink` / `-white` | Wordmark alone, when the owl already appears nearby |
| `*.png` | Same files as PNG (`-h128` = 128 px tall, etc.) for Word, PowerPoint, Canva, email |

Rules: leave clear space around the logo equal to the owl's eye width. Minimum size: 24 px tall for the horizontal logo
and 20 px for the owl. Don't recolour, stretch, rotate, add shadows or put the colour logo on busy photos.

## 2. Web app — `web/` (copy into your site's `public/` folder)
| File | Use |
|---|---|
| `favicon.ico`, `favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` | Browser tab icons (simplified owl, readable at 16 px) |
| `apple-touch-icon.png` | iPhone/iPad "Add to Home Screen" (180 × 180) |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Installable web app (PWA) icons |
| `site.webmanifest` | PWA manifest with app shortcuts (My learning, Explore, Certificates). Check the shortcut URLs match your routes |
| `og-image-1200x630.png` | Link preview on WhatsApp, Facebook, LinkedIn, X |
| `social-avatar-800.png` | Profile picture for social media pages |
| `email-logo-400.png` / `-800.png` | Email header (use the 400 px file at 200 px wide; the 800 is for sharp screens) |
| `rigbu-loader.svg` | **Animated loader**: the owl blinks and its light pulses. Respects "reduce motion" settings |

## 3. iOS app — `ios/`
| File | Use |
|---|---|
| `AppIcon-1024.png` | App Store + home screen icon (iOS rounds the corners) |
| `AppIcon-1024-dark.png` | iOS 18+ dark-mode icon (transparent background, by design) |
| `AppIcon-1024-tinted.png` | iOS 18+ tinted icon (greyscale; iOS adds the tint) |
| `icon-composer-layers/` | Background + owl as separate layers for Apple's Icon Composer (iOS 26 Liquid Glass icons) |
| `splash-1290x2796.png` | Launch screen |

## 4. Android app — `android/`
| File | Use |
|---|---|
| `play-store-512.png` | Google Play listing icon |
| `adaptive-foreground-432.png` + `adaptive-background-432.png` | Adaptive icon layers (owl sits inside the safe zone for every mask shape) |
| `adaptive-monochrome-432.png` | Android 13+ themed icon |
| `splash-icon-960.png` | Android 12+ splash screen icon (background colour `#F5B82E`) |
| `notification-icon-96.png` | Status-bar notification icon (white only, as Android requires) |

## 5. Expo / React Native — `expo/`
```json
{
  "expo": {
    "icon": "./assets/expo/icon.png",
    "splash": { "image": "./assets/expo/splash-icon.png", "resizeMode": "contain", "backgroundColor": "#F5B82E" },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/expo/adaptive-icon.png",
        "monochromeImage": "./assets/android/adaptive-monochrome-432.png",
        "backgroundColor": "#F5B82E"
      }
    },
    "notification": { "icon": "./assets/expo/notification-icon.png", "color": "#F5B82E" }
  }
}
```

## 6. Page icons — `icons/`
Twenty-nine icons, one for each page and main action. They share a 24 px grid, 1.75 stroke and rounded ends.
- **Outline** = idle; **active** (duotone, gold fill) = the page you are on. Swap them in tab bars and side menus.
- **Badges** (`icons/badges/`) = coloured tiles for page headers, dashboard cards and empty states. Colour shows the area:
  Learn = gold, Progress = green, Teach = ember, Account = slate.
- Formats: `svg/outline`, `svg/active` (colour follows the text colour), `rigbu-icons-sprite.svg`,
  PNG at 24/48/72 px (1×/2×/3×), and white versions for dark menus.

| Page / feature | Icon | Suggested route |
|---|---|---|
| Home | `home` | `/` |
| Explore | `explore` | `/courses` |
| Course catalogue / topics | `courses` | `/courses?category=…` |
| Course overview | `course-detail` | `/courses/[id]` |
| Lesson player | `lesson` | `/courses/[id]/lessons/[lessonId]` |
| Activities & quizzes | `activities` | inside lessons |
| Resources | `resources` | `/resources` |
| Schedule / live sessions | `calendar` | `/schedule` |
| AI study buddy | `ai-assistant` | `/ai` |
| My learning (dashboard) | `dashboard` | `/dashboard` |
| Progress & reports | `progress` | `/dashboard/reports` |
| Day streak | `streak` | dashboard widget |
| Certificates | `certificates` | `/certificates` |
| Verify certificate | `verify` | `/verify` |
| Create a course | `teach` | `/teach/create` |
| My courses (instructor) | `my-courses` | `/teach` |
| Course insights | `insights` | `/teach/insights` |
| Enrolment requests | `enrollments` | `/teach/enrollments` |
| Learners | `learners` | `/teach/learners` |
| Bhutan KYC | `kyc` | `/kyc` |
| Profile | `profile` | `/profile` |
| Settings | `settings` | `/settings` |
| Notifications | `notifications` | `/notifications` |
| Search | `search` | `/search` |
| Help & FAQ | `help` | `/#faq` |
| Reviews & community | `reviews` | `/community` |
| Admin panel | `admin` | `/admin` |
| Sign in / Sign out | `sign-in` / `sign-out` | `/auth/login` |

Routes are suggestions; only `/`, `/courses`, `/courses/[id]`, `/teach/create` and `/auth/login` are confirmed from the
live site.

**Recommended navigation**
- Mobile bottom tabs (max 5): Home · Explore · My learning · Certificates · Profile
- Web sidebar (signed in): My learning · Explore · Continue lesson · Certificates · Teach (instructors) · Settings

## 7. Mascot — `mascot/`
| Pose | Where to use it |
|---|---|
| `default` | Landing page hero, About page |
| `hello` | Sign in, welcome, onboarding, KYC start |
| `thinking` | Loading, empty states ("No courses yet"), search with no results |
| `celebrate` | Lesson/course complete, certificate issued, KYC approved |
| `oops` | 404 page, errors, failed upload |
| `sleepy` | Offline, maintenance, "No new notifications" |

Keep illustrations at 240 px wide or smaller in the app, and use one per screen.

## 8. Code — `code/`
- `RigbuIcon.tsx`: React component, e.g. `<RigbuIcon name="dashboard" active={isActive} />`. The active fill fades in.
  Colour follows `currentColor`, and the accent can be changed with the CSS variable `--rigbu-accent`.
- `brand.ts`: colours, font, page-to-icon map and mascot-pose guide.

## 9. Colours and type
| Name | Hex | Use |
|---|---|---|
| Gold | `#F5B82E` | Light of wisdom, active states, app-icon background |
| Ember | `#E8743B` | Left wing, highlights |
| Pine | `#2F6B4F` | Right wing on light backgrounds, success |
| Mint | `#6FC79A` | Right wing on dark backgrounds |
| Ink | `#1B2433` | Text, owl body, dark surfaces |
| Night | `#34446A` | Owl body on dark surfaces |
| Paper | `#FAF7F2` | Light surfaces |

The `rigbu` wordmark is custom lettering, so it needs no font file. For the rest of the interface, use
**Plus Jakarta Sans** (Google Fonts).
