
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupBlacklistedUrls() {
    const analysisPath = path.resolve(process.cwd(), 'kyobo_url_analysis.txt');
    if (!fs.existsSync(analysisPath)) {
        console.error('❌ kyobo_url_analysis.txt not found');
        return;
    }

    const content = fs.readFileSync(analysisPath, 'utf-8');
    const urls: string[] = [];

    // Extract URLs (simple regex for lines starting with URL:)
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('URL:')) {
            const url = line.replace('URL:', '').trim();
            if (url) urls.push(url);
        }
    }

    console.log(`Found ${urls.length} blacklisted URLs to remove.`);

    if (urls.length === 0) return;

    // Delete in batches
    const { error, count } = await supabase
        .from('lp_offers')
        .delete({ count: 'exact' })
        .in('url', urls);

    if (error) {
        console.error('❌ Error deleting offers:', error);
    } else {
        console.log(`✅ Successfully deleted ${count} offers matching blacklisted URLs.`);
    }
}

cleanupBlacklistedUrls();
