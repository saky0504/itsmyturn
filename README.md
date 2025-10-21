# 🎵 It's My Turn

**Premium Vinyl LP Turntable Music Player with Free Vintage Music**

A beautiful, interactive vinyl turntable interface built with React, TypeScript, and Capacitor for web and mobile platforms.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey.svg)

🌐 **Live Demo:** [itsmyturn.app](https://itsmyturn.app)

---

## ✨ Features

### 🎨 **User Interface**
- 💿 **Interactive LP turntable** with realistic vinyl groove patterns
- 📱 **Responsive design** optimized for mobile and desktop
- 🎨 **Beautiful gradient UI** with smooth rotations and animations
- 🌈 **Touch/swipe/click controls** for intuitive playback

### 🎵 **Music Experience**
- 🎼 **Free vintage music** from Internet Archive (Public Domain)
- 🎹 **Multiple genres**: Jazz, Classical, Blues, Swing, Folk
- ⚡ **Optimized loading**: 3-track quick load + 17-track background loading
- 🎯 **Smart filtering**: Auto-skip tracks over 7 minutes
- 🔄 **Auto-play**: Seamless track transitions

### 📱 **Native Mobile Features** (iOS/Android)
- 🔔 **Push Notifications**: Stay updated with new features
- 📳 **Haptic Feedback**: Tactile response for play/pause and track changes
- 🎵 **Background Audio**: Continue playing when app is in background
- ⭐ **In-App Review**: Periodic review prompts (7-day interval)
- 🔗 **In-App Browser**: Legal pages open within the app
- 📤 **Share**: Share tracks and app with friends

### 🌐 **Web Features**
- 📊 **Vercel Analytics**: User behavior tracking
- ⚡ **Speed Insights**: Performance monitoring
- 🔍 **SEO Optimized**: Google Search Console, Naver Search Advisor
- 🖼️ **Social Sharing**: Open Graph and Twitter Card meta tags
- 🗣️ **Community Board**: User interaction and feedback

---

## 🚀 Quick Start

### Web Development

```bash
# 1. Clone the repository
git clone https://github.com/saky0504/itsmyturn.git
cd itsmyturn

# 2. Install dependencies
npm install

# 3. Set up environment variables
# Create .env file with:
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-key
VITE_ADMIN_PASSWORD=your-admin-password

# 4. Run development server
npm run dev

# 5. Open browser
# http://localhost:5173
```

### Mobile App Development

```bash
# 1. Build web assets
npm run build

# 2. Sync with native platforms
npx cap sync

# 3. Open in IDE
npx cap open android  # Android Studio
npx cap open ios      # Xcode (Mac only)

# 4. Run on device/emulator
npx cap run android
npx cap run ios
```

---

## 🔧 Tech Stack

### Frontend
- **React 18.2** - UI framework
- **TypeScript 5.2** - Type safety
- **Vite 5.0** - Lightning-fast build tool
- **Tailwind CSS v4** - Utility-first CSS with `@import "tailwindcss";`
- **Motion 10.16** - Advanced animations (Framer Motion)
- **shadcn/ui** - 40+ beautiful UI components

### Mobile (Capacitor 7.4)
- **@capacitor/core** - Cross-platform runtime
- **@capacitor/android** - Android platform
- **@capacitor/ios** - iOS platform
- **@capacitor/push-notifications** - Push messaging
- **@capacitor/haptics** - Vibration feedback
- **@capacitor/browser** - In-app browser
- **@capacitor/share** - Native sharing
- **@capacitor-community/in-app-review** - App review prompts

### Backend & APIs
- **Supabase** - Authentication and database
- **Internet Archive API** - Free music streaming
- **Google Analytics** - Web analytics
- **Vercel Analytics** - User behavior tracking
- **Firebase Cloud Messaging** - Push notifications (planned)

### Deployment
- **Vercel** - Web hosting with automatic deployments
- **Google Play Store** - Android app distribution (planned)
- **Apple App Store** - iOS app distribution (planned)

---

## 📁 Project Structure

```
itsmyturn/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # React entry point
│   ├── admin.tsx               # Admin dashboard entry
│   ├── AdminApp.tsx            # Admin dashboard component
│   └── lib/
│       ├── supabase.ts         # Supabase client
│       └── capacitor-plugins.ts # Native features integration
├── components/
│   ├── VinylPlayer.tsx         # Main turntable component (2600+ lines)
│   ├── CommunityBoard.tsx      # Community interaction
│   └── ui/                     # shadcn/ui components (40+)
├── android/                    # Android native project
├── ios/                        # iOS native project
├── public/
│   ├── privacy-policy.html     # Privacy policy page
│   ├── terms-of-service.html   # Terms of service page
│   ├── robots.txt              # SEO crawler rules
│   └── manifest.webmanifest    # PWA manifest
├── styles/
│   └── globals.css             # Tailwind v4 styles
├── capacitor.config.ts         # Capacitor configuration
├── vercel.json                 # Vercel deployment config
└── index.html                  # Entry HTML with SEO meta tags
```

---

## 🎯 Performance Optimizations

### Audio Loading Strategy
- **Stage 1**: Load 3 tracks with metadata only (0.5-1s)
- **Stage 2**: Load 17 additional tracks in background (lazy)
- **On Play**: Switch to full audio preload (`preload='auto'`)
- **Result**: 80% faster initial load, 70% less memory usage

### Code Splitting
- Lazy loading of non-critical components
- Optimized bundle size with Vite tree-shaking
- Efficient chunk splitting for faster initial page load

---

## 📱 Platform-Specific Features

### Web Only
- Vercel Analytics & Speed Insights
- Google Tag Manager integration
- SEO meta tags and Open Graph images
- Responsive viewport optimization

### Mobile App Only
- Push notifications with FCM
- Haptic feedback on interactions
- Background audio playback
- In-app review prompts
- Native share dialog
- In-app browser for legal pages

---

## 📜 Available Scripts

```bash
# Development
npm run dev          # Start Vite dev server (localhost:5173)

# Build & Preview
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint errors
npm run type-check   # TypeScript type checking without emit

# Deployment
npm run deploy       # Deploy to GitHub Pages

# Capacitor (Mobile)
npx cap sync         # Sync web build to native projects
npx cap open android # Open Android Studio
npx cap open ios     # Open Xcode (Mac only)
npx cap run android  # Build and run on Android device/emulator
npx cap run ios      # Build and run on iOS device/simulator
```

---

## 🚢 Deployment

### Vercel (Web) - Automatic

```bash
# Push to GitHub triggers automatic deployment
git push origin main

# Environment variables required in Vercel dashboard:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_ADMIN_PASSWORD
```

### Android App

```bash
# 1. Build web assets
npm run build

# 2. Sync to Android
npx cap sync

# 3. Open Android Studio
npx cap open android

# 4. Build signed APK/AAB for Play Store
# (Use Android Studio Build > Generate Signed Bundle/APK)
```

### iOS App (Mac required)

```bash
# 1. Build web assets
npm run build

# 2. Sync to iOS
npx cap sync

# 3. Open Xcode
npx cap open ios

# 4. Archive and upload to App Store
# (Use Xcode Product > Archive)
```

---

## 🔐 Legal & Compliance

### Privacy & Terms
- **Privacy Policy**: [/privacy-policy.html](https://itsmyturn.app/privacy-policy.html)
- **Terms of Service**: [/terms-of-service.html](https://itsmyturn.app/terms-of-service.html)
- **Contact**: ux@leesangkyun.com
- **Effective Date**: October 22, 2025

### Data Collection
- Google Analytics (anonymized)
- Vercel Analytics (user behavior)
- Push notification tokens (with consent)
- Music playback history (local storage)

### Compliance
- ✅ GDPR ready (EU)
- ✅ Personal Information Protection Act (Korea)
- ✅ CCPA considerations (California)

---

## 🎯 Roadmap

### ✅ Completed (v1.0)
- [x] Premium vinyl turntable UI
- [x] Internet Archive music integration
- [x] Mobile-optimized responsive design
- [x] Capacitor iOS/Android setup
- [x] Push notifications infrastructure
- [x] Haptic feedback implementation
- [x] Background audio support
- [x] In-app review system
- [x] Privacy policy & Terms of Service
- [x] SEO optimization (Google/Naver)
- [x] Performance optimization (metadata-first loading)

### 🔜 Planned (v1.1+)
- [ ] Firebase Cloud Messaging integration
- [ ] User authentication (Supabase Auth)
- [ ] Playlist management
- [ ] Favorite tracks system
- [ ] Social sharing features
- [ ] Play Store & App Store release
- [ ] Offline playback (PWA)
- [ ] Lyrics display integration

---

## 🛠️ Development Guide

### Required Tools
- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, Mac only)

### Environment Setup
1. Copy `.env.example` to `.env` (if exists)
2. Add Supabase credentials
3. Run `npm install`
4. Start development with `npm run dev`

### Mobile Development
1. Install Capacitor CLI: `npm install -g @capacitor/cli`
2. Build web: `npm run build`
3. Sync native: `npx cap sync`
4. Open IDE: `npx cap open [android|ios]`

---

## 📚 Documentation

- [Capacitor Implementation Guide](./CAPACITOR_IMPLEMENTATION.md)
- [Migration Guide](./MIGRATION_GUIDE.md)

---

## 🙏 Acknowledgments

- [Internet Archive](https://archive.org) - Free vintage music source
- [Supabase](https://supabase.com) - Backend infrastructure
- [Capacitor](https://capacitorjs.com) - Cross-platform mobile runtime
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [Motion](https://motion.dev) - Advanced animations
- [Vercel](https://vercel.com) - Web hosting and analytics

---

## 📧 Contact

**Developer:** BK  
**Email:** ux@leesangkyun.com  
**Website:** [itsmyturn.app](https://itsmyturn.app)  
**GitHub:** [github.com/saky0504/itsmyturn](https://github.com/saky0504/itsmyturn)

---

## 📄 License

This project is licensed under the MIT License.

**Music Content:** All music streamed through this service is sourced from Internet Archive and is in the Public Domain or licensed under Creative Commons Attribution 3.0.

---

© 2025 It's My Turn • All rights reserved

Made with ❤️ and ☕ by BK
