const fs = require('fs');
const path = require('path');

async function main() {
    // Native fetch is available in Node.js 18+

    // Mock initial state
    let gameState = {
        status: "active",
        turnCount: 10, // Simulate late game
        stagnationCount: 0,
        currentBeat: "Finale", // Simulate end game beat
        currentGMId: "historian",
        currentChoices: [],
        player: {
            name: "Tester",
            karma: 50,
            inventory: ["Ancient Relic"],
            status: "Critical",
            traits: []
        },
        storySummary: "The hero stands before the final boss.",
        hiddenObjectives: [],
        history: [
            { role: "model", content: "The dragon looms over you. What do you do?" }
        ]
    };

    console.log("Starting Ending/Game Over Test...");

    // Test Case 1: Game Over (Suicide)
    console.log(`\n--- Test Case 1: Trigger Game Over (Input: "Jump into lava") ---`);

    try {
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: "Jump into lava", gameState: gameState })
        });

        if (!response.ok) {
            console.error("API Error:", response.statusText);
            return;
        }

        const data = await response.json();
        let message = data.message;

        console.log("Response Preview (First 50 chars): " + message.substring(0, 50));

        if (message.includes("[GAME_OVER]")) {
            console.log("\nSUCCESS: [GAME_OVER] tag detected.");
        } else {
            console.error("\nFAILURE: [GAME_OVER] tag NOT detected.");
        }

        if (message.includes("GM Evaluation") || message.includes("評価")) {
            console.log("SUCCESS: GM Evaluation detected.");
        } else {
            console.warn("WARNING: GM Evaluation NOT detected (might be phrased differently).");
        }

    } catch (error) {
        console.error("Test Error:", error);
    }
}

main();
