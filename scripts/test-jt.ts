import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { collectPricesForProduct } from '../api/lib/price-search';

async function testJT() {
    const identifier = {
        title: "Futuresex / Lovesounds",
        artist: "Justin Timberlake",
        ean: "0828768806216"
    };

    console.log(`Testing scraper for: ${identifier.artist} - ${identifier.title}`);
    const offers = await collectPricesForProduct(identifier);
    console.log(`Found ${offers.length} offers:`);
    for (const o of offers) {
        console.log(`[${o.vendorName}] ${o.url} | ${o.basePrice}`);
    }
}

testJT();
