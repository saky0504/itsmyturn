
import type { LpProduct } from '../data/lpMarket';

/**
 * Simple hash function to generate a numeric value from a string
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

    // 3. Score each item based on its ID and the daily seed
    // Using a per-item hash combined with the daily seed ensures that 
    // the score (and thus the order) for a specific item is constant for the whole day
    // regardless of the size of the array or the presence of other items.
    const scoredPool = pool.map(product => {
        // Create a unique string for this product on this specific day
        const itemKey = `${product.id}-${seed}`;
        const itemScore = cyrb128(itemKey);
        
        return {
            product,
            score: itemScore
        };
    });

    // Sort by the deterministic pseudo-random score descending
    scoredPool.sort((a, b) => b.score - a.score);

    // 4. Return top N products
    return scoredPool.slice(0, count).map(scored => scored.product);
}
