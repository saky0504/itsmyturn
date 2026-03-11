import { useCallback } from 'react';

// NOTE: Capacitor imports are temporarily replaced with web-safe stubs
// to avoid Vercel build issues as per the original VinylPlayer.tsx implementation.
// In the future, this hook can dynamically import from '../lib/capacitor-plugins'

export function useNativeFeatures() {
    const hapticMedium = useCallback(async () => {
        console.log('🎮 Haptic feedback (web)');
    }, []);

    const hapticHeavy = useCallback(async () => {
        console.log('🎮 Haptic feedback (web)');
    }, []);

    const initPushNotifications = useCallback(async () => {
        console.log('🔔 Push notifications (web)');
    }, []);

    const initAppStateListeners = useCallback(() => {
        console.log('📱 App state listeners (web)');
    }, []);

    const requestReview = useCallback(async () => {
        console.log('⭐ Review request (web)');
    }, []);

    const isNativePlatform = useCallback(() => {
        return false; // 웹에서는 항상 false
    }, []);

    const openInAppBrowser = useCallback(async (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
        console.log('🌐 Opened in new tab:', url);
    }, []);

    return {
        hapticMedium,
        hapticHeavy,
        initPushNotifications,
        initAppStateListeners,
        requestReview,
        isNativePlatform,
        openInAppBrowser
    };
}
