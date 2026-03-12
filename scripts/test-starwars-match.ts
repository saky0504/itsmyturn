import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { collectPricesForProduct } from '../api/lib/price-search';

async function testStarWars() {
    console.log('\n--- TESTING STAR WARS ---');
    const identifier = {
        title: "Star Wars",
        artist: "John Williams",
        vendor: "yes24",
    };

    // Test YES24
    const yes24Offers = await collectPricesForProduct(identifier);
    console.log('YES24 OFFERS:');
    yes24Offers.forEach(o => console.log(o.basePrice, o.url));

    const naverIdentifier = {
        title: "Star Wars",
        artist: "John Williams",
        vendor: "naver",
    }
    const naverOffers = await collectPricesForProduct(naverIdentifier);
    console.log('\nNAVER OFFERS:');
    naverOffers.forEach(o => console.log(o.basePrice, o.url));

}

testStarWars();
