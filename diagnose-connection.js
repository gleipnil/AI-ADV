const fs = require('fs');
const path = require('path');

async function diagnose() {
    console.log("Starting API Diagnosis (Manual Env Read)...");

    let apiKey = "";
    try {
        const envPath = path.join(__dirname, '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match && match[1]) {
            apiKey = match[1].trim();
        }
    } catch (e) {
        console.error("Error reading .env.local: " + e.message);
        return;
    }

    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY not found");
        return;
    }

    console.log("API Key found (length: " + apiKey.length + ")");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: "Hello" }] }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error Details:", errorText);

            if (response.status === 429) {
                console.error("DIAGNOSIS: Rate Limit Exceeded (429).");
            } else if (response.status === 503) {
                console.error("DIAGNOSIS: Service Unavailable (503).");
            } else if (response.status === 400) {
                console.error("DIAGNOSIS: Bad Request (400). Check model name or payload.");
            }
        } else {
            const data = await response.json();
            console.log("SUCCESS: API is working.");
        }

    } catch (error) {
        console.error("Network Error:", error);
    }
}

diagnose();
