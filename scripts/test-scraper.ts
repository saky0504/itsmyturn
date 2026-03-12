import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { collectPricesForProduct, ProductIdentifier } from '../api/lib/price-search';

async function test() {
    console.log('--- TESTING YES24 AND KYOBO PRODUCTION SCRAPERS ---');

    // Sade LP that was problematic
    const target: ProductIdentifier = {
        title: 'Stronger Than Pride',
        artist: 'Sade',
        ean: '5099746049713',
        vendor: 'kyobo'
    };

    console.log(`\nTesting Kyobo Search for ${target.title} - ${target.artist} (EAN: ${target.ean})`);
    const kyoboResults = await collectPricesForProduct(target);
    console.log(`Found ${kyoboResults.length} offers on Kyobo`);
    console.log(JSON.stringify(kyoboResults.map(r => ({ title: r.vendorName, price: r.basePrice })), null, 2));

    target.vendor = 'yes24';
    console.log(`\nTesting YES24 Search for ${target.title} - ${target.artist} (EAN: ${target.ean})`);

    // We already know collectPricesForProduct works, now we debug its internal match filter
    const yes24Results = await collectPricesForProduct(target);
    console.log(`Found ${yes24Results.length} offers on YES24`);
    console.log(JSON.stringify(yes24Results.map(r => ({ title: r.vendorName, price: r.basePrice })), null, 2));
}

test();
