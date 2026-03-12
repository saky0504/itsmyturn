import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function runTest() {
    const { upsertProductMetadataSafe } = await import('../api/lib/db-ingest');

    console.log('--- TESTING INGEST LOGIC (NEW ALBUM) ---');
    // Random obscure test album that shouldn't be in DB
    await upsertProductMetadataSafe({
        artist: 'Khruangbin',
        title: 'A La Sala',
        barcode: '5056614798150'
    });

    console.log('\n--- TESTING INGEST LOGIC (DUPLICATE PATCH) ---');
    // Should trigger Patch/Duplicate flow
    await upsertProductMetadataSafe({
        artist: 'Sade',
        title: 'Stronger Than Pride',
        description: 'Testing patch description injection'
    });
}

runTest();
