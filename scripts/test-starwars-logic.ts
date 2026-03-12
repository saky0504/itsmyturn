function tokenize(text: string): string[] {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim()
        .split(/\s+/)
        .filter(t => t.length > 0);
}

function isValidLpMatch(foundTitle: string, identifier: { artist: string, title: string }): boolean {
    if (!foundTitle) return false;

    const lowerTitle = foundTitle.toLowerCase();

    // 1. Filter out completely unrelated stuff often found in LP searches
    const excludedKeywords = [
        'cd', '카세트', '테이프', 'dvd', 'blu-ray', '블루레이', '악보', 't-shirt',
        '의류', '턴테이블', '바늘', '카트리지', '포스터', '슬리브', '속지', '겉지', '보호필름',
        'player', '플레이어', 'turntable', '스피커', '앰프', '리시버'
    ];
    if (excludedKeywords.some(keyword => lowerTitle.includes(keyword) && !identifier.title.toLowerCase().includes(keyword))) {
        return false;
    }

    // Tokenize the found title
    const foundTitleStr = tokenize(foundTitle).join(' ');
    const foundTokens = tokenize(foundTitle);

    // Tokenize identifier artist and title separately
    const artistTokens = identifier.artist ? tokenize(identifier.artist) : [];
    const albumTokens = identifier.title ? tokenize(identifier.title) : [];

    let artistMatchCount = 0;
    for (const token of artistTokens) {
        if (foundTitleStr.includes(token)) artistMatchCount++;
    }

    let albumMatchCount = 0;
    for (const token of albumTokens) {
        if (foundTitleStr.includes(token)) albumMatchCount++;
    }

    const albumMatchRatio = albumTokens.length > 0 ? albumMatchCount / albumTokens.length : 1;
    const totalTokens = artistTokens.length + albumTokens.length;
    const matchCount = artistMatchCount + albumMatchCount;
    const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.3));

    console.log(`[${foundTitle}]`);
    console.log(` -> Album Match Ratio: ${albumMatchRatio} (${albumMatchCount}/${albumTokens.length})`);
    console.log(` -> Total match: ${matchCount} >= required: ${requiredMatches}`);

    if (albumMatchRatio < 0.4) {
        console.log(" -> REJECTED: album match ratio < 0.4");
        return false;
    }

    if (matchCount < requiredMatches) {
        console.log(" -> REJECTED: matchCount < requiredMatches");
        return false;
    }

    const hasLpKeyword = ['lp', 'vinyl', '바이닐'].some(k => lowerTitle.includes(k));
    if (!hasLpKeyword) {
        console.log(" -> REJECTED: No LP keyword");
        return false;
    }

    const allowedExtraTokens = new Set([
        'lp', 'vinyl', '바이닐', 'ost', 'soundtrack', '사운드트랙', 'gatefold', 'remastered', 'edition', 'anniversary',
        'color', 'coloured', '컬러', '음반', '수입', '한정반', '투명', '블랙', '화이트', '레드', '블루', '한정',
        '투명컬러', '2lp', '3lp', '180g', '140g', '레코드', 'record', 'records', 'vol', 'pt', 'part', 'the', 'of', 'and', 'in', 'a', 'to', 'for', 'with', 'on', 'at', 'by', 'original', 'motion', 'picture', 'score'
    ]);

    let extraSubstantiveCount = 0;
    for (const token of foundTokens) {
        if (!artistTokens.includes(token) && !albumTokens.includes(token) && !allowedExtraTokens.has(token) && isNaN(Number(token))) {
            extraSubstantiveCount++;
            console.log(`   + Extra token: '${token}'`);
        }
    }

    // STRICTER penalty: limit extra substantive words drastically for short titles
    const maxAllowedExtra = Math.max(1, Math.floor(albumTokens.length * 0.5));
    console.log(` -> Extra substantive: ${extraSubstantiveCount} (max allowed: ${maxAllowedExtra})`);

    if (extraSubstantiveCount > maxAllowedExtra) {
        console.log(" -> REJECTED: Too many extra substantive tokens");
        return false;
    }

    console.log(" -> ACCEPTED");
    return true;
}

const target = { artist: "John Williams", title: "Star Wars" };
const mockTitles = [
    "John Williams - Star Wars OST LP",
    "John Williams - Star Wars: The Empire Strikes Back (LP)",
    "Star Wars : Return Of The Jedi (LP)",
    "John Williams The Phantom Menace 2LP"
];

for (const t of mockTitles) {
    isValidLpMatch(t, target);
}
