const url = 'https://www.yes24.com/Product/Search?domain=ALL&query=Sade%20Stronger%20Than%20Pride%20LP';

async function checkRedirect() {
    const response = await fetch(url, {
        redirect: 'manual',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Location: ${response.headers.get('location')}`);
}

checkRedirect();
