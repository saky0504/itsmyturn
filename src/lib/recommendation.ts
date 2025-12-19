
import type { LpProduct } from '../data/lpMarket';

/**
 * Simple seeded random number generator (Mulberry32)
 * Returns a function that generates numbers between 0 and 1
 */
function mulberry32(a: number) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

/**
 * String hash function to generate a numeric seed from a date string
 */
function cyrb128(str: string): number {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

/**
 * Get 5 daily fixed recommendations based on the current date
 */
export function getDailyLpRecommendations(products: LpProduct[], count: number = 5): LpProduct[] {
    if (!products || products.length === 0) return [];

    // 1. Filter candidates (Must have cover image & title)
    // Optional: Prefer items with offers or specific tags if needed
    const candidates = products.filter(p =>
        p.cover &&
        !p.cover.includes('default') &&
        p.title &&
        p.artist !== 'Unknown Artist'
    );

    // If not enough valid candidates, fallback to original list
    const pool = candidates.length >= count ? candidates : products;

    // 2. Generate Seed from Date (Korea Time)
    // We want the same key for everyone in the same day
    const now = new Date();
    // Use fixed timezone offset for consistency (KST = UTC+9)
    // Simplified: Just use YYYY-MM-DD string is usually fine if client times are similar, 
    // but better to force a 'day' value irrespective of hour.
    const dateKey = now.toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul'
    });

    const seed = cyrb128(dateKey);
    const random = mulberry32(seed);

    // 3. Shuffle (Fisher-Yates with seeded random)
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 4. Return top N
    return shuffled.slice(0, count);
}
