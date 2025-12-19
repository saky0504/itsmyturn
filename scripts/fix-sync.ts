
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve(process.cwd(), 'scripts/sync-lp-data.ts');
const content = readFileSync(filePath, 'utf-8');

const OLD_FUNC_START = `async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  try {
    let searchUrl = '';`;

// We just match the start and verify if it's the old one
if (!content.includes(OLD_FUNC_START)) {
    console.error('❌ Could not find old function start. Already patched?');
    process.exit(1);
}

// Construct the new function
const NEW_FUNC = `/**
 * 알라딘에서 LP 가격 정보 가져오기 (Open API 사용)
 */
async function fetchAladinPrice(identifier: ProductIdentifier): Promise<VendorOffer | null> {
  const aladinTtbKey = process.env.ALADIN_TTB_KEY;
  if (!aladinTtbKey) return null;

  try {
    const params = new URLSearchParams({
      ttbkey: aladinTtbKey,
      QueryType: identifier.ean ? 'Keyword' : 'Keyword',
      Query: identifier.ean || \`\${identifier.artist} \${identifier.title} LP\`,
      MaxResults: '10',
      start: '1',
      SearchTarget: 'Music',
      Output: 'JS',
      Version: '20131101'
    });

    const url = \`http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?\${params.toString()}\`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.item || !Array.isArray(data.item) || data.item.length === 0) return null;

    let targetItem = null;
    let targetPrice = 0;

    for (const item of data.item) {
        if (!item.title || !item.priceSales) continue;
        const price = item.priceSales || item.priceStandard;
        
        // Validation
        if (!isValidPrice(price)) continue;

        const title = item.title;
        const catName = item.categoryName || '';
        const isVinylCat = catName.toLowerCase().includes('vinyl') || catName.toLowerCase().includes('lp');
        const isCDParams = title.toLowerCase().includes('cd') || title.toLowerCase().includes('compact disc');

        if (!isVinylCat && !hasRequiredKeywords(title)) continue;
        if (isCDParams && !isVinylCat) continue;

        if (!identifier.ean && identifier.title) {
            const similarity = calculateSimilarity(identifier.title, title);
            const isContained = title.toLowerCase().includes(identifier.title.toLowerCase());
            if (similarity < 0.8 && !isContained) continue; 
        }

        targetItem = item;
        targetPrice = price;
        break;
    }

    if (!targetItem) return null;

    console.log(\`[알라딘] Found price: \${targetPrice}원 for \${identifier.title}\`);

    return {
      vendorName: '알라딘',
      channelId: 'aladin-api',
      basePrice: targetPrice,
      shippingFee: 0,
      shippingPolicy: '조건부 무료',
      url: targetItem.link,
      inStock: targetItem.stockStatus !== '', 
      affiliateCode: 'itsmyturn',
      affiliateParamKey: 'Acode',
    };

  } catch (error) {
    console.error('[알라딘] API Error:', error);
    return null;
  }
}`;

// Use Regex to replace the function block
// The old function ends with "console.error('[YES24] Error:', error);\n    return null;\n  }\n}"
// We need to be careful with regex special chars
const regex = /async function fetchAladinPrice[\s\S]*?console\.error\('\[YES24\] Error:', error\);\s*return null;\s*\}\s*\}/;

if (!regex.test(content)) {
    console.error('❌ Regex match failed. The code structure might be different.');
    // Fallback: Use string split if possible, or just search for the unique error string which we verified existed.
    // Unique Error String from View: "[YES24] Error:" inside fetchAladinPrice
    // Let's try to locate the start and end by index.
}

const newContent = content.replace(regex, NEW_FUNC);

if (newContent === content) {
    console.error('❌ Replacement resulted in identical content.');
    process.exit(1);
}

writeFileSync(filePath, newContent, 'utf-8');
console.log('✅ Successfully patched fetchAladinPrice in sync-lp-data.ts');
