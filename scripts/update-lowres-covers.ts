import { createClient } from '@supabase/supabase-js';
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function updateLowResCovers() {
  console.log('🔍 Searching for low-res Discogs covers...');
  
  // We fetch Discogs products only
  const { data: products, error } = await supabase
    .from('lp_products')
    .select('id, title, artist, cover, discogs_id')
    .not('discogs_id', 'like', 'aladin-%')
    .not('discogs_id', 'is', null);

  if (error) {
    console.error('Failed to fetch from DB:', error);
    return;
  }

  // Find products that have '150' in their cover URL (which indicates the 150x150 thumbnail)
  const lowResProducts = products.filter(p => p.cover && p.cover.includes('150'));

  console.log(`Found ${lowResProducts.length} low-res covers to upgrade.`);

  let updatedCount = 0;
  for (const product of lowResProducts) {
    console.log(`Fetching high-res cover for: [${product.discogs_id}] ${product.artist} - ${product.title}`);
    
    const detailUrl = `https://api.discogs.com/releases/${product.discogs_id}`;
    
    try {
      const detailRes = await fetch(detailUrl, {
        headers: {
          'User-Agent': 'itsmyturn-updater/1.0',
          'Accept': 'application/json',
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`
        }
      });
      
      if (!detailRes.ok) {
        if (detailRes.status === 429) {
          console.log('⚠️ Rate limit hit. Sleeping for 30s...');
          await sleep(30000);
          continue; // skip and may run the script again later if needed
        }
        console.error(`❌ Discogs API error (${detailRes.status}) for ${product.discogs_id}`);
        await sleep(2000);
        continue;
      }
      
      const detail = await detailRes.json();
      const highResUri = detail.images?.[0]?.uri || detail.images?.[0]?.uri150 || detail.thumb || product.cover;
      
      if (highResUri !== product.cover) {
        const { error: updateErr } = await supabase
          .from('lp_products')
          .update({ cover: highResUri })
          .eq('id', product.id);
          
        if (updateErr) {
          console.error(`❌ DB Update error for ${product.id}:`, updateErr.message);
        } else {
          console.log(`✅ Updated cover (High-Res) for [${product.discogs_id}]`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️ No better image found for [${product.discogs_id}]`);
      }
      
    } catch (err: any) {
      console.error(`❌ Network error for ${product.discogs_id}:`, err.message);
    }
    
    // Sleep to prevent hitting rate limits
    await sleep(2000);
  }
  
  console.log(`🎉 Upgrade completed! Updated ${updatedCount} covers.`);
}

updateLowResCovers().catch(console.error);
