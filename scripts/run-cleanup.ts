
import { cleanupBadProducts, cleanupBadOffers } from './cleanup';

(async () => {
    console.log('Running manual cleanup...');
    await cleanupBadProducts();
    await cleanupBadOffers();
    console.log('Done.');
})();
