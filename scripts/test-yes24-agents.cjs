const url = 'https://www.yes24.com/Product/Search?domain=ALL&query=Sade%20Stronger%20Than%20Pride%20LP';

async function testAgents() {
    const agents = [
        'Mozilla/5.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    ];

    for (const agent of agents) {
        const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': agent } });
        console.log(`Agent: ${agent}`);
        console.log(`Status: ${res.status}\n`);
    }
}

testAgents();
