import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { collectPricesForProduct } from '../api-lib/price-search';

async function testBeatles() {
    console.log('\n--- TESTING BEATLES RUBBER SOUL ---');
    const identifier = {
        title: "Rubber Soul",
        artist: "The Beatles",
        vendor: "yes24",
    };

    // Test YES24
    const yes24Offers = await collectPricesForProduct(identifier);
    console.log('YES24 OFFERS:', yes24Offers);
}

testBeatles();
