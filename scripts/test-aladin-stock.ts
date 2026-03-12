import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testAladin() {
    console.log('\n--- ALADIN ---');
    const aladinTtbKey = process.env.ALADIN_TTB_KEY;
    const query = 'Justin Timberlake Futuresex LP';
    const url = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinTtbKey}&QueryType=Keyword&Query=${encodeURIComponent(query)}&MaxResults=5&start=1&SearchTarget=Music&Output=JS&Version=20131101`;

    const res = await fetch(url);
    const data = await res.json();

    for (const item of data.item || []) {
        console.log(`Title: ${item.title}`);
        console.log(`Price: ${item.priceSales}`);
        console.log(`StockStatus: "${item.stockStatus}"`);
        console.log('---');
    }
}

testAladin();
