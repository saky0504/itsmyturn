import { VinylPlayer } from '../components/VinylPlayer';
import { Toaster } from '../components/ui/sonner';

export default function App() {
  return (
    <div className="size-full">
      <VinylPlayer />
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
          success: {
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#6b7280',
              border: '1px solid rgba(0, 0, 0, 0.03)',
            },
            iconTheme: {
              primary: '#6b7280',
              secondary: 'rgba(255, 255, 255, 0.95)',
            },
          },
          error: {
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#6b7280',
              border: '1px solid rgba(0, 0, 0, 0.03)',
            },
            iconTheme: {
              primary: '#6b7280',
              secondary: 'rgba(255, 255, 255, 0.95)',
            },
          },
          info: {
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#6b7280',
              border: '1px solid rgba(0, 0, 0, 0.03)',
            },
            iconTheme: {
              primary: '#6b7280',
              secondary: 'rgba(255, 255, 255, 0.95)',
            },
          },
        }}
      />
    </div>
  );
}