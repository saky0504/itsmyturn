import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const { data, count } = await s
    .from('lp_products')
    .select('id,title,artist', { count: 'exact' })
    .limit(5);
  console.log('total:', count);
  console.log(JSON.stringify(data, null, 2));
})();
