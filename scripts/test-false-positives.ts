import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { collectPricesForProduct } from '../api/lib/price-search-debug';

async function testGorillaz() {
    const identifier = {
        title: "Gorillaz",
        artist: "Gorillaz",
        ean: "" // No EAN to force keyword search
    };

    console.log(`\nTesting scraper for: ${identifier.artist} - ${identifier.title}`);
    const offers = await collectPricesForProduct(identifier);
    console.log(`Found ${offers.length} offers:`);
    for (const o of offers) {
        console.log(`[${o.vendorName}] ${o.url} | ${o.basePrice}`);
    }
}

async function testJT() {
    const identifier = {
        title: "Futuresex / Lovesounds",
        artist: "Justin Timberlake",
        ean: ""
    };

    console.log(`\nTesting scraper for: ${identifier.artist} - ${identifier.title}`);
    const offers = await collectPricesForProduct(identifier);
    console.log(`Found ${offers.length} offers:`);
    for (const o of offers) {
        console.log(`[${o.vendorName}] ${o.url} | ${o.basePrice}`);
    }
}

async function main() {
    await testGorillaz();
    await testJT();
}

main();
