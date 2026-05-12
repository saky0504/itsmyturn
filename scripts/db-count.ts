import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const { count } = await s.from('lp_products').select('*', { count: 'exact', head: true });
  console.log('LP total:', count);

  // Check if recent additions (Led Zeppelin, Radiohead) are in sitemap
  const { data: recent } = await s
    .from('lp_products')
    .select('id, title, artist, created_at')
    .or('artist.ilike.%Led Zeppelin%,artist.ilike.%Radiohead%')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Recent:', recent);
})();
