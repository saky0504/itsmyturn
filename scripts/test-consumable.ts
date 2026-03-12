function tokenize(str: string): string[] {
    return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, ' ').split(/\s+/).filter(w => w.length > 1);
}

function isValidLpMatch(foundTitle: string, identifier: { artist: string, title: string }): boolean {
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
        if (new RegExp(`\\b${word}\\b`).test(lowerTitle)) return false;
    }
    if (blackListIncludes.some(k => lowerTitle.includes(k))) return false;

    // 2. Token Matching with Consumption
    const titleTokens = tokenize(lowerTitle);
    const artistTokens = identifier.artist ? tokenize(identifier.artist) : [];
    const albumTokens = identifier.title ? tokenize(identifier.title) : [];

    if (artistTokens.length === 0 && albumTokens.length === 0) return true;

    let artistMatchCount = 0;
    for (const token of artistTokens) {
        const idx = titleTokens.findIndex(t => t.includes(token));
        if (idx !== -1) {
            artistMatchCount++;
            // Consume the matched token from the scraped title pool so it can't be reused
            titleTokens.splice(idx, 1);
        }
    }

    let albumMatchCount = 0;
    for (const token of albumTokens) {
        const idx = titleTokens.findIndex(t => t.includes(token));
        if (idx !== -1) {
            albumMatchCount++;
            // Consume
            titleTokens.splice(idx, 1);
        }
    }

    console.log(`Title: ${foundTitle} | ArtistMatch: ${artistMatchCount}/${artistTokens.length} | AlbumMatch: ${albumMatchCount}/${albumTokens.length} | Leftovers: ${titleTokens}`);

    if (albumTokens.length > 0) {
        const requiredAlbumMatches = Math.max(1, Math.floor(albumTokens.length * 0.4));
        if (albumMatchCount < requiredAlbumMatches) {
            return false;
        }
    }

    const totalTokens = artistTokens.length + albumTokens.length;
    const matchCount = artistMatchCount + albumMatchCount;
    const requiredMatches = Math.max(1, Math.floor(totalTokens * 0.4));

    if (matchCount < requiredMatches) return false;

    const hasLpKeyword = ['lp', 'vinyl', '바이닐'].some(k => lowerTitle.includes(k));
    if (!hasLpKeyword) return false;

    return true;
}

const idGorillaz = { artist: 'Gorillaz', title: 'Gorillaz' };
console.log('Demon Days:', isValidLpMatch('Gorillaz (고릴라즈) - Demon Days[2LP]', idGorillaz));  // Expected FALSE
console.log('Now Now:', isValidLpMatch('[LP] 고릴라즈(Gorillaz) NOWNOW', idGorillaz)); // Expected FALSE
console.log('Self Titled 1:', isValidLpMatch('고릴라즈 - Gorillaz Vinyl 바이닐 LP', idGorillaz)); // Expected TRUE
console.log('Self Titled 2:', isValidLpMatch('Gorillaz Gorillaz LP', idGorillaz)); // Expected TRUE
console.log('Self Titled 3 (Tricky):', isValidLpMatch('Gorillaz 1st Album LP', idGorillaz)); // Expected FALSE (sadly, but safer)

const idJT = { artist: 'Justin Timberlake', title: 'Futuresex / Lovesounds' };
console.log('Justified:', isValidLpMatch('Justin Timberlake Vinyl 비닐 LP 레코드 Justified', idJT)); // Expected FALSE
console.log('FutureSex:', isValidLpMatch('저스틴 팀버레이크 Justin Timberlake - Futuresex / Love Sound [2LP]', idJT)); // Expected TRUE
