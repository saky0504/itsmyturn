function tokenize(str) {
    return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

function isValidLpMatch(foundTitle, identifier) {
    if (!foundTitle) return false;

    const lowerTitle = foundTitle.toLowerCase();

    // 1. Strict Blacklist
    const blackListExact = ['cd', 'dvd', 'mp3', 'wav', 'flac'];
    const blackListIncludes = [
        '디지털', '오디오', 'cassette', '카세트', 'tape', '테이프', 'blu-ray', '블루레이',
        '포스터', 'poster', '티셔츠', '의류', '굿즈', '잡지', 'magazine', '액자',
        '키링', 'keyring', '체중계', 'scale', '저울', '달력', 'calendar',
        '보호', '슬리브', '클리너', '브러쉬'
    ];

    for (const word of blackListExact) {
        const rx = new RegExp(`\\b${word}\\b`);
        if (rx.test(lowerTitle)) return false;
    }
    if (blackListIncludes.some(k => lowerTitle.includes(k))) return false;

    // 2. Token Matching
    const titleTokensStr = tokenize(lowerTitle).join(' ');
    const artistTokens = identifier.artist ? tokenize(identifier.artist) : [];
    const albumTokens = identifier.title ? tokenize(identifier.title) : [];

    if (artistTokens.length === 0 && albumTokens.length === 0) return true;

    let matchCount = 0;
    for (const token of artistTokens) {
        if (titleTokensStr.includes(token)) matchCount++;
    }
    for (const token of albumTokens) {
        if (titleTokensStr.includes(token)) matchCount++;
    }

    const totalTokens = artistTokens.length + albumTokens.length;
    // 기존 방식: 하나만 맞으면 통과
    const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.3));

    console.log(`Title: ${foundTitle} | ArtistTokens: ${artistTokens} | AlbumTokens: ${albumTokens} | MatchCount: ${matchCount} | Required: ${requiredMatches}`);

    if (matchCount < requiredMatches) {
        return false;
    }

    const hasLpKeyword = ['lp', 'vinyl', '바이닐'].some(k => lowerTitle.includes(k));
    if (!hasLpKeyword) {
        return false;
    }

    return true;
}

const identifier = { artist: "Justin Timberlake", title: "Futuresex / Lovesounds" };
console.log("FutureSex:", isValidLpMatch("Justin Timberlake - Futuresex / Lovesounds 2LP 바이닐", identifier));
console.log("Justified (FALSE POSITIVE TEST):", isValidLpMatch("저스틴 팀버레이크 Justin Timberlake - Justified LP", identifier));
console.log("Everything I Thought It Was (FALSE POSITIVE TEST):", isValidLpMatch("Justin Timberlake - Everything I Thought It Was LP", identifier));
