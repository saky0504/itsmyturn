import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';

// Lazy load all heavy components for better initial load performance
const VinylPlayer = lazy(() => import('../components/VinylPlayer').then(module => ({ default: module.VinylPlayer })));
const LpHome = lazy(() => import('./pages/market/LpHome').then(module => ({ default: module.LpHome })));
const LpPriceList = lazy(() => import('./pages/market/LpPriceList').then(module => ({ default: module.LpPriceList })));
const LpProductDetail = lazy(() => import('./pages/market/LpProductDetail').then(module => ({ default: module.LpProductDetail })));
const LpChannelDetail = lazy(() => import('./pages/market/LpChannelDetail').then(module => ({ default: module.LpChannelDetail })));

function LoadingFallback() {
  return (
    <div className="size-full flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-600">로딩 중...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <div className="size-full">
                <VinylPlayer />
              </div>
            </Suspense>
          }
        />
        <Route 
          path="/market" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <LpHome />
            </Suspense>
          } 
        />
        <Route 
          path="/market/list" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <LpPriceList />
            </Suspense>
          } 
        />
        <Route 
          path="/market/lp/:productId" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <LpProductDetail />
            </Suspense>
          } 
        />
        <Route 
          path="/market/channels/:channelId" 
          element={
            <Suspense fallback={<LoadingFallback />}>
              <LpChannelDetail />
            </Suspense>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-center"
        closeButton
        duration={4000}
        className="z-50"
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            color: '#6b7280',
            border: '1px solid rgba(0, 0, 0, 0.03)',
            borderRadius: '8px',
            boxShadow: '0 1px 8px rgba(0, 0, 0, 0.02)',
            backdropFilter: 'blur(2px)',
            fontWeight: '400',
          },
        }}
      />
    </BrowserRouter>
  );
}
