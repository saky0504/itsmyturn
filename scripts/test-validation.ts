
// Mock helpers for testing
function normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[len1][len2];
}

function calculateSimilarity(str1: string, str2: string): number {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1.0 - (distance / maxLength);
}

function isValidPrice(price: number): boolean {
    return price >= 15000 && price <= 300000;
}

function hasRequiredKeywords(text: string): boolean {
    const lower = text.toLowerCase();
    const required = ['lp', 'vinyl', '바이닐', '레코드', 'limited', 'edition'];
    return required.some(k => lower.includes(k));
}

// Test cases
const similarityTests = [
    { t: 'The Beatles', r: 'Beatles', expect: 0.8 },
    { t: 'Abbey Road', r: 'Abbey Road (Remastered)', expect: 0.5 }, // Might fail strict check?
    { t: 'Kind of Blue', r: 'Blue', expect: 0.4 },
    { t: 'Pink Floyd', r: 'Pink Floyd - The Wall', expect: 0.5 },
];

console.log('--- Similarity Tests ---');
similarityTests.forEach(({ t, r, expect }) => {
    const sim = calculateSimilarity(t, r);
    console.log(`"${t}" vs "${r}" -> ${sim.toFixed(2)} (Pass > 0.8? ${sim >= 0.8})`);
});

const priceTests = [3900, 15000, 25000, 350000];
console.log('\n--- Price Tests ---');
priceTests.forEach(p => console.log(`${p}: ${isValidPrice(p)}`));

const keywordTests = ['Nirvana - Nevermind (LP)', 'BTS CD', 'Poster of Linkin Park', 'Limited Edition Vinyl'];
console.log('\n--- Keyword Tests ---');
keywordTests.forEach(k => console.log(`"${k}": ${hasRequiredKeywords(k)}`));

console.log('\n--- Containment Logic Tests (Fallback) ---');
similarityTests.forEach(({ t, r, expect }) => {
    const sim = calculateSimilarity(t, r);
    const contained = normalizeString(r).includes(normalizeString(t));
    const pass = sim >= 0.8 || contained;
    console.log(`"${t}" vs "${r}" -> Sim: ${sim.toFixed(2)}, Contained: ${contained} => Final Match: ${pass}`);
});
