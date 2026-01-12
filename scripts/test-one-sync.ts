import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

// Run partial sync with just one product
async function testOneProduct() {
    const { partialSync } = await import('./partial-sync-test.js');

    // Override to sync only 1 product
    await partialSync(1);
}

testOneProduct().catch(console.error);
