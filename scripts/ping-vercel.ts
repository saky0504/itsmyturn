async function checkLiveDeploy() {
    const url = "https://itsmyturn.app/api/search-prices";
    let ok = false;

    for (let i = 0; i < 20; i++) {
        console.log(`[Attempt ${i + 1}] Pinging ${url}...`);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist: "John Williams", title: "Star Wars" })
            });
            console.log(`Status: ${res.status}`);
            if (res.status === 200 || res.status === 400) {
                const json = await res.json();
                if (!json.error || !json.error.includes("Cannot find module")) {
                    console.log("✅ Vercel deploy succeeded! API is responding correctly:", JSON.stringify(json, null, 2).substring(0, 300));
                    ok = true;
                    break;
                }
            }
        } catch (e) { }

        // Wait 10 seconds before next ping
        await new Promise(r => setTimeout(r, 10000));
    }
}
checkLiveDeploy();
