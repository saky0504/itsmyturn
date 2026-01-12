import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { throw new Error('Missing Supabase credentials'); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function nukeAllOffers() {
    console.log('💣 NUCLEAR OPTION: Deleting ALL offers from lp_offers table...\n');

    // Get count first
    const { count } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true });

    console.log(`Found ${count} total offers to delete.`);
    console.log('This will take a moment...\n');

    // Delete all offers
    const { error } = await supabase
        .from('lp_offers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

    if (error) {
        console.error('Error deleting offers:', error);
        throw error;
    }

    console.log('✅ All offers deleted successfully!\n');

    // Verify
    const { count: remainingCount } = await supabase
        .from('lp_offers')
        .select('*', { count: 'exact', head: true });

    console.log(`Remaining offers: ${remainingCount}`);

    if (remainingCount === 0) {
        console.log('\n🎉 Database is clean! Ready for fresh data collection.');
    }
}

nukeAllOffers().then(() => {
    console.log('\n⚠️  IMPORTANT: Run the hourly-sync job to repopulate with validated data.');
    console.log('   Command: npm run hourly-sync');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
