import { useState } from 'react';
import { toast } from 'sonner';

interface ArchiveItem {
    identifier: string;
    title?: string;
    creator?: string | string[];
    licenseurl?: string;
    [key: string]: unknown;
}

export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover: string;
    preview_url: string;
    duration: number;
    spotify_url: string;
    lyrics?: string;
    genre?: string;
    spotify_id?: string;
    license?: string;
}

const INITIAL_TRACK: Track = {
    id: '78_wedding-march_symphony-orchestra-mendelssohn_gbia0012855a',
    title: 'Wedding March',
    artist: 'Symphony Orchestra',
    album: 'Internet Archive',
    cover: 'https://archive.org/services/img/78_wedding-march_symphony-orchestra-mendelssohn_gbia0012855a',
    preview_url: '/music/wedding_march.mp3',
    duration: 183000,
    spotify_url: '',
    lyrics: 'Pre-loaded for instant playback',
    genre: 'Classical',
    license: 'Public Domain'
};

export function useArchiveMusic() {
    const [tracks, setTracks] = useState<Track[]>([INITIAL_TRACK]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // 장르별 검색 쿼리 생성
    const getGenreSearchQueries = (genre: string) => {
        const baseQueries = [
            `collection:78rpm AND mediatype:audio`,
            `collection:netlabels AND mediatype:audio`,
            `collection:etree AND mediatype:audio`
        ];

        switch (genre) {
            case 'jazz':
                return [
                    ...baseQueries.map(q => `${q} AND subject:(jazz OR swing OR big band)`),
                    'collection:78rpm AND mediatype:audio AND (title:(jazz OR swing) OR creator:(jazz OR swing))'
                ];
            case 'classical':
                return [
                    ...baseQueries.map(q => `${q} AND subject:(classical OR symphony OR orchestra)`),
                    'collection:78rpm AND mediatype:audio AND (title:(classical OR symphony) OR creator:(classical OR symphony))'
                ];
            case 'blues':
                return [
                    ...baseQueries.map(q => `${q} AND subject:(blues OR rhythm)`),
                    'collection:78rpm AND mediatype:audio AND (title:(blues OR rhythm) OR creator:(blues OR rhythm))'
                ];
            case 'swing':
                return [
                    ...baseQueries.map(q => `${q} AND subject:(swing OR big band OR dance)`),
                    'collection:78rpm AND mediatype:audio AND (title:(swing OR dance) OR creator:(swing OR dance))'
                ];
            case 'folk':
                return [
                    `collection:netlabels AND mediatype:audio AND subject:(folk OR acoustic)`,
                    `collection:etree AND mediatype:audio AND subject:(folk OR acoustic)`
                ];
            case 'all':
            default:
                return [
                    'collection:78rpm AND mediatype:audio',
                    'collection:netlabels AND mediatype:audio',
                    'collection:etree AND mediatype:audio'
                ];
        }
    };

    // Internet Archive Search API로 실제 음원 검색
    const searchInternetArchive = async (query: string, rows: number = 50) => {
        try {

            const sortOptions = [
                'downloads desc',
                'addeddate desc',
                'publicdate desc',
                'date desc',
                'avg_rating desc',
                'random' // 완전 랜덤
            ];

            const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
            const randomPage = Math.floor(Math.random() * 10);
            const startRow = randomPage * rows;

            const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=avg_rating&fl[]=licenseurl&rows=${rows}&start=${startRow}&sort[]=${encodeURIComponent(randomSort)}&output=json`;


            const response = await fetch(searchUrl);
            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();

            return data.response.docs;
        } catch (error) {
            console.error('❌ Internet Archive search failed:', error);
            throw error;
        }
    };

    // Internet Archive Metadata API로 실제 스트리밍 URL 추출
    const getStreamingUrl = async (identifier: string, item?: { title?: string; creator?: string | string[]; licenseurl?: string;[key: string]: unknown }) => {
        try {

            const metadataUrl = `https://archive.org/metadata/${identifier}`;
            const response = await fetch(metadataUrl);

            if (!response.ok) {
                throw new Error(`Metadata fetch failed: ${response.status}`);
            }

            const data = await response.json();

            // MP3 파일 찾기 (우선순위: .mp3 > .ogg > .wav)
            const mp3Files = data.files.filter((file: { name: string; format: string }) =>
                file.name.endsWith('.mp3') &&
                file.format !== 'Metadata' &&
                !file.name.includes('_files.xml')
            );

            if (mp3Files.length === 0) {
                throw new Error('No MP3 files found');
            }

            const audioFile = mp3Files[0];
            const streamingUrl = `https://archive.org/download/${identifier}/${audioFile.name}`;
            const coverUrl = `https://archive.org/services/img/${identifier}`;

            const shouldUseDuck =
                identifier.includes('dragnet') ||
                item?.title?.toLowerCase().includes('radio') ||
                item?.title?.toLowerCase().includes('episode') ||
                (Array.isArray(item?.creator) ? item.creator.join(' ').toLowerCase() : item?.creator?.toLowerCase?.() || '').includes('radio');

            const finalCoverUrl = shouldUseDuck ? '/images/hi.png' : coverUrl;

            return {
                streamingUrl,
                coverUrl: finalCoverUrl,
                duration: audioFile.length ? parseInt(audioFile.length) * 1000 : 180000,
                fileSize: audioFile.size
            };
        } catch (error) {
            console.error(`❌ Failed to get streaming URL for ${identifier}:`, error);
            throw error;
        }
    };

    const loadTracksByGenre = async (genre: string = 'all') => {
        try {
            setIsLoading(true);

            const searchQueries = getGenreSearchQueries(genre);
            let allItems: ArchiveItem[] = [];

            for (const query of searchQueries) {
                try {
                    const items = await searchInternetArchive(query, 15);
                    allItems = allItems.concat(items);
                } catch (error) {
                    console.warn(`Search query failed: ${query}`, error);
                }
            }

            const uniqueItems = allItems.filter((item, index, self) =>
                index === self.findIndex(t => t.identifier === item.identifier)
            );

            const musicItems = uniqueItems.filter(item => {
                const licenseUrl = String(item.licenseurl || '').toLowerCase();
                const hasAttribution3 = licenseUrl.includes('creativecommons.org/licenses/by/3.0') ||
                    licenseUrl.includes('attribution') ||
                    licenseUrl.includes('publicdomain') ||
                    licenseUrl === '';

                if (!hasAttribution3 && licenseUrl) {
                    return false;
                }

                const title = String(item.title || '').toLowerCase();
                const creator = Array.isArray(item.creator)
                    ? item.creator.join(', ').toLowerCase()
                    : String(item.creator || '').toLowerCase();

                if (title.includes('.com')) {
                    return false;
                }

                const excludeKeywords = [
                    'audiobook', 'podcast', 'radio drama', 'lecture', 'speech',
                    'story', 'book', 'reading', 'narration', 'episode', 'season',
                    'part 1', 'part 2', 'chapter', 'series', 'broadcast',
                    'interview', 'conversation', 'discussion', 'talk', 'show',
                    'news', 'documentary', 'educational', 'instructional'
                ];

                const hasExcludeKeyword = excludeKeywords.some(keyword =>
                    title.includes(keyword) || creator.includes(keyword)
                );

                const musicKeywords = [
                    'song', 'music', 'jazz', 'blues', 'classical', 'swing',
                    'band', 'orchestra', 'singer', 'vocal', 'instrumental',
                    'album', 'single', 'recording', 'performance', 'concert'
                ];

                const hasMusicKeyword = musicKeywords.some(keyword =>
                    title.includes(keyword) || creator.includes(keyword)
                );

                const isValid = !hasExcludeKeyword && (hasMusicKeyword || item.identifier.includes('78rpm'));
                return isValid;
            });


            const itemsToUse = musicItems.length > 0 ? musicItems : uniqueItems;
            const shuffledItems = [...itemsToUse].sort(() => Math.random() - 0.5);
            const selectedItems = shuffledItems.slice(0, 25);

            const archiveTracks: Track[] = [];

            for (let i = 0; i < selectedItems.length && archiveTracks.length < 3; i++) {
                const item = selectedItems[i];
                try {
                    if (item.identifier === INITIAL_TRACK.id) continue;

                    const { streamingUrl, coverUrl, duration } = await getStreamingUrl(item.identifier, item);

                    if (duration > 420000) {
                        continue;
                    }

                    const track: Track = {
                        id: item.identifier,
                        title: item.title || 'Unknown Title',
                        artist: Array.isArray(item.creator) ? (item.creator[0] || 'Unknown Artist') : (item.creator || 'Unknown Artist'),
                        album: item.identifier,
                        cover: coverUrl,
                        preview_url: streamingUrl,
                        duration: duration,
                        spotify_url: `https://open.spotify.com/search/${encodeURIComponent(item.title || '')}`,
                        lyrics: `From Internet Archive\nClassic audio recording\nPublic domain music`,
                        genre: 'Classical',
                        license: item.licenseurl || 'Public Domain'
                    };

                    archiveTracks.push(track);

                    setTracks(prev => {
                        if (prev.find(t => t.id === track.id)) return prev;
                        return [...prev, track];
                    });

                } catch (error) {
                    console.warn(`❌ Failed to process item ${item.identifier}:`, error);
                }
            }

            if (archiveTracks.length === 0) {
                throw new Error('No playable tracks found');
            }

            if (archiveTracks.length > 1) {
                setTracks(prevTracks => {
                    const remainingTracks = archiveTracks.slice(1);
                    const newTracks = remainingTracks.filter((newTrack: Track) =>
                        !prevTracks.some(existingTrack => existingTrack.id === newTrack.id)
                    );
                    return [...prevTracks, ...newTracks];
                });
            }

            if (archiveTracks.length >= 3) {
                setTimeout(async () => {
                    const additionalTracks: Track[] = [];

                    for (let i = 3; i < selectedItems.length && additionalTracks.length < 17; i++) {
                        const item = selectedItems[i];
                        try {
                            const { streamingUrl, coverUrl, duration } = await getStreamingUrl(item.identifier, item);

                            if (duration > 420000) {
                                continue;
                            }

                            const track: Track = {
                                id: item.identifier,
                                title: item.title || 'Unknown Title',
                                artist: item.creator?.[0] || 'Unknown Artist',
                                album: 'Internet Archive',
                                cover: coverUrl,
                                preview_url: streamingUrl,
                                duration: duration,
                                spotify_url: '',
                                lyrics: '',
                                genre: genre,
                                license: item.licenseurl || 'Public Domain'
                            };

                            additionalTracks.push(track);
                        } catch {
                        }
                    }

                    if (additionalTracks.length > 0) {
                        setTracks(prevTracks => [...prevTracks, ...additionalTracks]);
                    }
                }, 2000);
            }

            setIsInitialLoading(false);

        } catch (error) {
            console.error('❌ Failed to load tracks:', error);
            toast.error(`Failed to load tracks: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
            setIsInitialLoading(false);
        }
    };

    const loadRecommendations = async () => {
        const genres = ['jazz', 'classical', 'blues', 'swing', 'folk', 'all'];
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        await loadTracksByGenre(randomGenre);
    };

    return {
        tracks,
        setTracks,
        isLoading,
        isInitialLoading,
        loadTracksByGenre,
        loadRecommendations
    };
}
