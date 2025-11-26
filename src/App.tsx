import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { VinylPlayer } from '../components/VinylPlayer';
import { Toaster } from '../components/ui/sonner';
import { LpPriceList } from './pages/market/LpPriceList';
import { LpProductDetail } from './pages/market/LpProductDetail';
import { LpChannelDetail } from './pages/market/LpChannelDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div className="size-full">
              <VinylPlayer />
            </div>
          }
        />
        <Route path="/market" element={<LpPriceList />} />
        <Route path="/market/lp/:productId" element={<LpProductDetail />} />
        <Route path="/market/channels/:channelId" element={<LpChannelDetail />} />
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
