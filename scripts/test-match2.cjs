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

    let artistMatchCount = 0;
    for (const token of artistTokens) {
        if (titleTokensStr.includes(token)) artistMatchCount++;
    }
    let albumMatchCount = 0;
    for (const token of albumTokens) {
        if (titleTokensStr.includes(token)) albumMatchCount++;
    }

    // 앨범명 토큰이 존재한다면, 반드시 앨범명 중에서 하나 이상은 매치되어야 함. (비율 40%)
    if (albumTokens.length > 0) {
        const requiredAlbumMatches = Math.max(1, Math.floor(albumTokens.length * 0.4));
        if (albumMatchCount < requiredAlbumMatches) {
            return false;
        }
    }

    const totalTokens = artistTokens.length + albumTokens.length;
    const matchCount = artistMatchCount + albumMatchCount;
    // 전체 토큰 중에서도 40%는 매칭되어야 함
    const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.4));

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
console.log("FutureSex (EXPECT TRUE):", isValidLpMatch("Justin Timberlake - Futuresex / Lovesounds 2LP 바이닐", identifier));
console.log("Justified (EXPECT FALSE):", isValidLpMatch("저스틴 팀버레이크 Justin Timberlake - Justified LP", identifier));
console.log("Everything I Thought It Was (EXPECT FALSE):", isValidLpMatch("Justin Timberlake - Everything I Thought It Was LP", identifier));

const id2 = { artist: "Sade", title: "Stronger Than Pride" };
console.log("Sade STP (EXPECT TRUE):", isValidLpMatch("Sade - Stronger Than Pride (LP)", id2));
console.log("Sade Diamond (EXPECT FALSE):", isValidLpMatch("Sade - Diamond Life (LP)", id2));
