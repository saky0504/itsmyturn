# 🎵 It's My Turn

**Premium LP Turntable Music Player with Spotify Integration**

A beautiful, interactive vinyl turntable UI built with React, TypeScript, and modern web technologies.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

- 🎨 **Premium 5-layer vinyl groove pattern system**
- 💿 **Interactive LP turntable** with realistic animations
- 📱 **Touch/swipe/click controls** for mobile & desktop
- 🌈 **Beautiful gradient UI** with smooth rotations
- 🔊 **Hardware volume key support** with elegant toasts
- 🎧 **Complete Spotify API integration** ready
- 📱 **Mobile-optimized** responsive design

---

## 🚀 Quick Start

### Option 1: Docker (Recommended for portability)

```bash
# 1. Clone the repository
git clone https://github.com/saky0504/itsmyturn.git
cd itsmyturn

# 2. Set up environment variables
cp env.example .env
# Edit .env with your Supabase credentials

# 3. Start with Docker
docker-compose up

# 4. Open browser
# http://localhost:3000
```

### Option 2: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/saky0504/itsmyturn.git
cd itsmyturn

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.example .env
# Edit .env with your Supabase credentials

# 4. Run development server
npm run dev

# 5. Open browser
# http://localhost:3000
```

---

## 🔧 Tech Stack

- **Frontend:**
  - React 18.2
  - TypeScript 5.2
  - Vite 5.0
  - Tailwind CSS v4 (next)
  - Motion 10.16 (Framer Motion)
  - shadcn/ui component library

- **Backend:**
  - Supabase (BaaS)
  - Supabase Edge Functions (Deno)
  - Spotify Web API

- **DevOps:**
  - Docker & Docker Compose
  - Vercel / Netlify deployment
  - GitHub Actions (CI/CD ready)

---

## 📁 Project Structure

```
itsmyturn/
├── src/
│   ├── App.tsx              # Main application component
│   └── main.tsx             # React entry point
├── components/
│   ├── VinylPlayer.tsx      # Main turntable component
│   └── ui/                  # Shadcn UI components
├── supabase/
│   └── functions/           # Edge Functions
├── styles/
│   └── globals.css          # Global styles & Tailwind
├── docker-compose.yml       # Docker orchestration
├── Dockerfile               # Container definition
└── DOCKER_GUIDE.md          # Detailed Docker instructions
```

---

## 🐳 Docker Development

Perfect for working across multiple locations (home ↔️ office ↔️ café).

**Benefits:**
- ✅ Consistent Node.js environment
- ✅ No dependency conflicts
- ✅ 5-minute setup on new machines
- ✅ Team-ready development environment

**See [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) for detailed instructions.**

---

## 🌐 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get your Supabase credentials from: https://app.supabase.com

---

## 📜 Available Scripts

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Build
npm run build        # Production build
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run type-check   # TypeScript type checking

# Deployment
npm run deploy       # Deploy to GitHub Pages
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

### GitHub Pages

```bash
npm run deploy
```

---

## 📱 Mobile Development

Test on real devices:

```bash
# Find your local IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Access from mobile
http://<your-ip>:3000

# With Docker
docker-compose up
# Automatically exposes 0.0.0.0:3000
```

---

## 🎯 Roadmap

- [x] Premium vinyl turntable UI
- [x] Touch/swipe controls
- [x] Spotify API integration
- [x] Docker development environment
- [ ] Playlist management
- [ ] Social sharing features
- [ ] User authentication
- [ ] Favorite tracks system

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 📚 Documentation

- [Docker Guide](./DOCKER_GUIDE.md) - Complete Docker setup and usage
- [Migration Guide](./MIGRATION_GUIDE.md) - Figma Make to Vite migration
- [Backup Guide](./BACKUP_GUIDE.md) - Backup and restore procedures

---

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) - Backend infrastructure
- [Spotify](https://spotify.com) - Music API
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling framework
- [Motion](https://motion.dev) - Animations

---

## 📧 Contact

Project Link: [https://github.com/saky0504/itsmyturn](https://github.com/saky0504/itsmyturn)

---

Made with ❤️ by the Vinyl Player Team
