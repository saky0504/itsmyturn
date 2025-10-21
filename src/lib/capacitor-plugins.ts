// Capacitor Native Plugins Integration
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';
import { InAppReview } from '@capacitor-community/in-app-review';
import { Browser } from '@capacitor/browser';

/**
 * Check if running on native platform
 */
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Get platform name (ios, android, web)
 */
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

// ========================================
// 1. Push Notifications
// ========================================

export const initPushNotifications = async () => {
  if (!isNativePlatform()) return;

  try {
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      console.log('✅ Push notifications registered');
    }

    // Listen for registration
    await PushNotifications.addListener('registration', (token) => {
      console.log('📱 Push registration success, token: ' + token.value);
      // TODO: Send token to your backend
    });

    // Listen for registration error
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error);
    });

    // Listen for incoming notifications
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Push notification received:', notification);
      // TODO: Handle notification
    });

    // Listen for notification tap
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Push notification action performed:', action);
      // TODO: Handle notification tap
    });
  } catch (error) {
    console.error('❌ Push notification init error:', error);
  }
};

// ========================================
// 2. Haptic Feedback
// ========================================

/**
 * Light haptic feedback for button taps
 */
export const hapticLight = async () => {
  if (!isNativePlatform()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.warn('Haptic feedback not available:', error);
  }
};

/**
 * Medium haptic feedback for play/pause
 */
export const hapticMedium = async () => {
  if (!isNativePlatform()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.warn('Haptic feedback not available:', error);
  }
};

/**
 * Heavy haptic feedback for track changes
 */
export const hapticHeavy = async () => {
  if (!isNativePlatform()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.warn('Haptic feedback not available:', error);
  }
};

// ========================================
// 3. App State & Background Audio
// ========================================

/**
 * Initialize app state listeners
 */
export const initAppStateListeners = (
  onResume?: () => void,
  onPause?: () => void
) => {
  if (!isNativePlatform()) return;

  App.addListener('appStateChange', ({ isActive }) => {
    console.log(`📱 App state changed. Is active: ${isActive}`);
    
    if (isActive && onResume) {
      onResume();
    } else if (!isActive && onPause) {
      onPause();
    }
  });
};

// ========================================
// 4. In-App Review
// ========================================

const REVIEW_REQUEST_KEY = 'lastReviewRequestDate';
const REVIEW_COMPLETED_KEY = 'reviewCompleted';
const REVIEW_INTERVAL_DAYS = 7;

/**
 * Check if we should show review prompt
 */
export const shouldShowReviewPrompt = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;

  try {
    // Check if user already reviewed
    const { value: reviewCompleted } = await Preferences.get({ key: REVIEW_COMPLETED_KEY });
    if (reviewCompleted === 'true') {
      return false;
    }

    // Check last request date
    const { value: lastRequestDate } = await Preferences.get({ key: REVIEW_REQUEST_KEY });
    
    if (!lastRequestDate) {
      return true; // First time
    }

    const lastDate = new Date(lastRequestDate);
    const now = new Date();
    const daysSinceLastRequest = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysSinceLastRequest >= REVIEW_INTERVAL_DAYS;
  } catch (error) {
    console.error('❌ Error checking review prompt:', error);
    return false;
  }
};

/**
 * Request in-app review
 */
export const requestReview = async () => {
  if (!isNativePlatform()) return;

  try {
    const shouldShow = await shouldShowReviewPrompt();
    
    if (!shouldShow) {
      console.log('⏭️ Skipping review prompt (too soon or already completed)');
      return;
    }

    // Update last request date
    await Preferences.set({
      key: REVIEW_REQUEST_KEY,
      value: new Date().toISOString(),
    });

    // Request review
    await InAppReview.requestReview();
    console.log('⭐ Review prompt shown');
    
    // Note: We can't detect if user actually reviewed, but we'll mark it after showing
    // You might want to add custom logic here
  } catch (error) {
    console.error('❌ Error requesting review:', error);
  }
};

/**
 * Mark review as completed (call this if user manually rates)
 */
export const markReviewCompleted = async () => {
  if (!isNativePlatform()) return;

  try {
    await Preferences.set({
      key: REVIEW_COMPLETED_KEY,
      value: 'true',
    });
    console.log('✅ Review marked as completed');
  } catch (error) {
    console.error('❌ Error marking review completed:', error);
  }
};

// ========================================
// 5. Share Functionality
// ========================================

/**
 * Share current track
 */
export const shareTrack = async (trackTitle: string, trackArtist: string) => {
  try {
    await Share.share({
      title: `It's My Turn 🎵`,
      text: `Check out "${trackTitle}" by ${trackArtist} on It's My Turn!`,
      url: 'https://itsmyturn.app',
      dialogTitle: 'Share this track',
    });
    
    console.log('✅ Share dialog shown');
  } catch (error) {
    console.error('❌ Share error:', error);
  }
};

/**
 * Share app
 */
export const shareApp = async () => {
  try {
    await Share.share({
      title: `It's My Turn - Vinyl Turntable Music Player`,
      text: 'Check out this beautiful vinyl turntable music player! 🎵',
      url: 'https://itsmyturn.app',
      dialogTitle: 'Share It\'s My Turn',
    });
    
    console.log('✅ Share dialog shown');
  } catch (error) {
    console.error('❌ Share error:', error);
  }
};

// ========================================
// 6. In-App Browser
// ========================================

/**
 * Open URL in In-App Browser (native) or new tab (web)
 */
export const openInAppBrowser = async (url: string) => {
  try {
    if (isNativePlatform()) {
      // Native: Open in In-App Browser
      await Browser.open({ 
        url,
        presentationStyle: 'popover', // iOS: popover style
        toolbarColor: '#ffffff'
      });
      console.log('✅ Opened in In-App Browser:', url);
    } else {
      // Web: Open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
      console.log('✅ Opened in new tab:', url);
    }
  } catch (error) {
    console.error('❌ Browser open error:', error);
  }
};

/**
 * Close In-App Browser (only works on native)
 */
export const closeInAppBrowser = async () => {
  if (!isNativePlatform()) return;
  
  try {
    await Browser.close();
    console.log('✅ In-App Browser closed');
  } catch (error) {
    console.error('❌ Browser close error:', error);
  }
};

