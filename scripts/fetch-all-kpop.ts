import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const STATE_FILE = path.join(process.cwd(), '.kpop-sync-state.json');
const REQUEST_DELAY_MS = 1500; // 1.5초 대기 (분당 40회 호출 수준으로 안전하게 제한)
const PER_PAGE = 50;

// Env loading (로컬 실행이므로 .env 파일 등을 사용한다고 가정)
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || process.env.DISCOGS_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

if (!DISCOGS_TOKEN) {
  console.error('❌ Missing Discogs token.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function discogsHeaders() {
  return {
    'User-Agent': 'itsmyturn-batch-sync/1.0',
    'Accept': 'application/json',
    'Authorization': `Discogs token=${DISCOGS_TOKEN}`
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to parse state file, starting from page 1.');
    }
  }
  return { page: 1, totalPages: null };
}

function saveState(state: any) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function detectTracklistLanguage(tracks: any[]): 'ko' | 'en' | 'other' {
  if (!tracks || !Array.isArray(tracks)) return 'other';
  const titles = tracks.map(t => t.title).join(' ');
  if (/[가-힣]/.test(titles)) return 'ko';
  if (/^[a-zA-Z0-9\s\.,\-'()\:\!\?&\/]+$/.test(titles)) return 'en';
  return 'other';
}

async function startSync() {
  let state = loadState();
  console.log(`🚀 Starting Discogs K-Pop Sync from Page ${state.page}...`);

  while (true) {
    if (state.totalPages && state.page > state.totalPages) {
      console.log('✅ Finished all available pages!');
      break;
    }

    console.log(`\n================================`);
    console.log(`📡 Fetching Page ${state.page} ${state.totalPages ? `(of ${state.totalPages})` : ''}...`);

    try {
      // 1. 페이지 단위 검색
      // style="K-Pop", format="LP"
      const searchUrl = `https://api.discogs.com/database/search?type=release&format=LP&style=K-Pop&per_page=${PER_PAGE}&page=${state.page}`;
      const searchRes = await fetch(searchUrl, { headers: discogsHeaders() });
      
      if (!searchRes.ok) {
        if (searchRes.status === 429) {
          console.log(`⚠️ Rate limit exceeded on search. Sleeping for 1 minute...`);
          await sleep(60000);
          continue; // Retry same page
        }
        throw new Error(`Search failed: ${searchRes.status} ${searchRes.statusText}`);
      }

      const searchData = await searchRes.json();
      const results = searchData.results || [];
      
      if (state.totalPages === null && searchData.pagination) {
        state.totalPages = searchData.pagination.pages;
        saveState(state);
      }

      if (results.length === 0) {
        console.log(`No more results found. Ending.`);
        break;
      }

      console.log(`Found ${results.length} items on page ${state.page}. Filtering...`);

      // 2. DB 중복 체크 (Batch)
      const discogsIds = results.map((r: any) => String(r.id));
      const { data: existingRecords, error: dbError } = await supabase
        .from('lp_products')
        .select('discogs_id')
        .in('discogs_id', discogsIds);
      
      if (dbError) {
        throw new Error(`DB Error: ${dbError.message}`);
      }

      const existingIds = new Set(existingRecords?.map((r: any) => r.discogs_id) || []);

      // lp_editions의 discogs_id도 체크 (병합된 에디션의 재추가 방지)
      const { data: editionRecords } = await supabase
        .from('lp_editions')
        .select('discogs_id')
        .in('discogs_id', discogsIds);
      for (const ed of editionRecords || []) {
        if (ed.discogs_id) existingIds.add(ed.discogs_id);
      }

      const newItems = results.filter((r: any) => !existingIds.has(String(r.id)));

      console.log(`>> ${newItems.length} new items to process, ${existingIds.size} already in DB (에디션 포함).`);

      // 3. 신규 아이템 상세정보 Fetch 및 Insert
      for (const item of newItems) {
        const discogsId = String(item.id);
        
        // Wait before exact fetch to prevent rate limit
        await sleep(REQUEST_DELAY_MS);
        
        console.log(`    Fetching details for ID: ${discogsId}...`);
        const detailRes = await fetch(`https://api.discogs.com/releases/${discogsId}`, { headers: discogsHeaders() });
        
        if (!detailRes.ok) {
          if (detailRes.status === 429) {
             console.log(`    ⚠️ Rate limit exceeded on details. Pausing and skipping this item for now...`);
             await sleep(30000);
             continue;
          }
           console.log(`    ❌ Failed fetching details for ${discogsId} : ${detailRes.status}`);
           continue;
        }

        const detail = await detailRes.json();

        // 아티스트 정리
        const artist = (detail.artists || []).map((a: { name: string }) => a.name.replace(/\s*\(\d+\)\s*$/, '')).join(', ') || 'Unknown Artist';
        const title = detail.title || item.title?.split(' - ').slice(1).join(' - ') || item.title;
        const tracklist = detail.tracklist || [];
        const barcode = detail.identifiers?.find((i: { type: string }) => i.type === 'Barcode')?.value || null;

        const { error: insertError } = await supabase.from('lp_products').insert({
            title,
            artist,
            cover: detail.images?.[0]?.uri || detail.images?.[0]?.uri150 || detail.thumb || null,
            format: 'LP',
            discogs_id: discogsId,
            ean: barcode,
            description: detail.notes || '',
            genres: detail.genres || [],
            styles: detail.styles || [],
            track_list: tracklist,
            release_date: detail.released || null,
            last_synced_at: new Date().toISOString(),
        });

        if (insertError) {
             console.log(`    ❌ DB Insert Error for ${discogsId} : ${insertError.message}`);
        } else {
             console.log(`    ✅ Inserted: ${artist} - ${title}`);
        }
      }

      // 4. Update status and move to next page
      state.page++;
      saveState(state);
      
      // Wait before moving to next page
      await sleep(REQUEST_DELAY_MS);

    } catch (error) {
      console.error(`\n❌ Error processing page ${state.page}:`, error);
      console.log(`Waiting 10 seconds before retrying...`);
      await sleep(10000);
    }
  }

  console.log(`\n🎉 Sync job completed!`);
}

startSync().catch(console.error);
