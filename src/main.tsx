import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '../styles/globals.css'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"

// StrictMode는 개발 환경에서만 활성화 (프로덕션 성능 향상)
const isDev = import.meta.env.DEV;

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (isDev) {
  root.render(
    <React.StrictMode>
      <App />
      <SpeedInsights />
      <Analytics />
    </React.StrictMode>
  );
} else {
  root.render(
    <>
      <App />
      <SpeedInsights />
      <Analytics />
    </>
  );
}
