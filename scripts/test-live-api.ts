async function checkError() {
    const url = "https://itsmyturn.app/api/search-prices";
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artist: "John Williams", title: "Star Wars", vendor: "yes24" })
        });
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error(e);
    }
}
checkError();
