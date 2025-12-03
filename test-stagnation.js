const fs = require('fs');
const path = require('path');

async function main() {
    // Native fetch is available in Node.js 18+

    // Mock initial state
    let gameState = {
        status: "active",
        turnCount: 1,
        stagnationCount: 0,
        currentBeat: "Opening Image",
        currentGMId: "historian",
        currentChoices: [],
        player: {
            name: "Tester",
            karma: 50,
            inventory: [],
            status: "Normal",
            traits: []
        },
        storySummary: "Start",
        hiddenObjectives: [],
        history: []
    };

    console.log("Starting Stagnation Test...");

    for (let i = 1; i <= 5; i++) {
        console.log(`\n--- Turn ${i} (Input: "Wait") ---`);

        try {
            const response = await fetch("http://localhost:3000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: "Wait", gameState: gameState })
            });

            if (!response.ok) {
                console.error("API Error:", response.statusText);
                break;
            }

            const data = await response.json();
            let message = data.message;
            let isStagnant = false;

            if (message.includes("[STAGNATION]")) {
                isStagnant = true;
                console.log("TAG DETECTED: [STAGNATION]");
                message = message.replace("[STAGNATION]", "").trim();
            } else {
                console.log("TAG NOT DETECTED");
            }

            console.log("Response Preview:", message.substring(0, 100) + "...");

            // Update state
            gameState.stagnationCount = isStagnant ? gameState.stagnationCount + 1 : 0;
            gameState.turnCount++;
            gameState.history.push({ role: "user", content: "Wait" });
            gameState.history.push({ role: "model", content: message });

            console.log("New Stagnation Count:", gameState.stagnationCount);

        } catch (error) {
            console.error("Test Error:", error);
            break;
        }
    }
}

main();
