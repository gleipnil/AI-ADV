import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PERSONALITIES } from "@/lib/personalities";
import { STORY_STRUCTURES, StoryStructureName } from "@/lib/story-structures";
import { GameState } from "@/lib/types";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { input, gameState }: { input: string; gameState: GameState } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Gemini API key not configured" },
                { status: 500 }
            );
        }

        const currentGM = PERSONALITIES[gameState.currentGMId];
        const currentStructureName = gameState.currentStructure as StoryStructureName;
        const beats = STORY_STRUCTURES[currentStructureName];
        const beatInfo = beats.find(b => b.name === gameState.currentBeat) || beats[0];

        // Create a list of all beats in the current structure for the AI to reference
        const beatList = beats.map(b => `- ${b.name}: ${b.description}`).join("\n");

        // Build the prompt
        const systemInstruction = `
You are the Game Master of a text-based adventure game.
Your current persona is: ${currentGM.name} (${currentGM.description}).
${currentGM.systemPrompt}

Current Story Structure: ${currentStructureName}
Current Story Beat: ${gameState.currentBeat}
Beat Description: ${beatInfo.description}
Turn: ${gameState.turnCount}
Stagnation Count: ${gameState.stagnationCount}

Available Beats in this Structure:
${beatList}

Player Status:
- Name: ${gameState.player.name}
- Karma: ${gameState.player.karma} (0-100, higher is chaotic)
- Inventory: ${gameState.player.inventory.join(", ") || "None"}

Instructions:
1. Respond to the player's input: "${input}".
2. Evaluate if the player's input advances the story or reveals significant new information.
   - If the story does NOT advance (e.g., repeated "Look", "Wait", nonsense, or loops), append the tag [STAGNATION] to the end of your response (invisible to player).
   - If the story advances, do NOT append the tag.
3. Handle Stagnation & Pacing:
   - **Turn > 16**: If Stagnation Count >= 3, you MUST FORCE a scene change. The environment changes drastically, or a new threat appears. Do NOT allow the player to stay in the same situation.
   - **Turn > 25**: The story is ending. Rush towards the climax and conclusion.
   - **Turn > 30**: If the player resists the ending, FORCE a "Reasonable Misfortune" (Game Over) or a chaotic bad end.
   - **Turn 4-8 (Set-up Phase)**: If the player is exploring alone, introduce an NPC or a clear sign of life (e.g., footprints, a voice, a distant figure). Offer a chance for conversation or interaction, but do not force it if the player chooses to ignore it.
   - If Stagnation Count is 0-2 (and Turn <= 16): Provide a narrative warning if count > 0.
   - If Stagnation Count is 3 (and Turn <= 16): Inflict a minor penalty.
   - If Stagnation Count is 4+: FORCE the story forward.
4. Advance the story according to the current beat.
   - **Dynamic Skipping**: If the player's action dramatically changes the situation, you can SKIP ahead.
   - To skip, append the tag [JUMP_TO: BeatName] to the end of your response.
   - Example: [JUMP_TO: Finale]
5. Maintain your persona's tone: ${currentGM.tone}.
6. Provide a response in Japanese.
7. After your response, suggest 2-3 choices for the player. Format choices as: [ID] Label - Description.
   - **IMPORTANT**: The [ID] MUST be a single alphabet letter (e.g., [A], [B], [C]).
   - Example: [N] North - Go to the forest.
8. Do NOT output JSON. Output raw text formatted for a retro terminal.
9. **Game Endings**:
   - If the player successfully completes the main objective or reaches a narrative conclusion, output the tag [THE_END] at the very end.
   - If the player dies or fails irrevocably, output the tag [GAME_OVER] at the very end.
10. **GM Evaluation (Required when [THE_END] or [GAME_OVER] is triggered)**:
    - Before the tag, provide a "GM Evaluation" section.
    - **Summary**: 1-2 lines summarizing the story (in Japanese).
    - **Feedback**: Evaluate the player's actions (in Japanese).
    - Format this section clearly (e.g., using "=== GM評価 ===").
11. **GM Recommendation (Invisible to Player)**:
    Analyze the player's latest action: "${input}".
    Based on the action's intent, recommend the most suitable GM personality to take over (or keep the current one).
    - **Warlord**: Aggressive, violent, confrontational.
    - **Detective**: Analytical, investigative, logical.
    - **Jester**: Chaotic, funny, tricky, nonsense.
    - **Bard**: Emotional, poetic, dramatic, protective.
    - **Storyteller**: Fearful, cautious, horror-focused, running away.
    - **Cyberpunk**: Tech-savvy, hacking, digital.
    - **MadGod**: Meta-gaming, breaking the 4th wall, glitching, system probing.
    
    **Rules for Recommendation**:
    - **Early Game (Turns 1-5)**: Be HIGHLY SENSITIVE to player intent. If the player shows even a slight leaning towards a specific style (e.g., a single attack, a single joke, a single question), recommend the corresponding GM IMMEDIATELY. Do not wait for a repeated pattern.
    - If the action is standard or unclear, recommend the **Current GM**.
    - If the action is nonsense/gibberish but harmless, recommend **Jester** (or keep current).
    - If the action attempts to break the game or access system internals, recommend **MadGod**.
    
    Output the tag [RECOMMEND_GM: gm_id] at the very end of your response.
    Example: [RECOMMEND_GM: warlord]
`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-lite-preview-02-05",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        // Construct chat history for context
        // Truncate to last 40 messages to prevent context length issues
        const recentHistory = gameState.history.slice(-40);
        const chatHistory = recentHistory.map(h => ({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.content }],
        }));

        // Retry logic for 503 errors
        let retryCount = 0;
        const maxRetries = 3;
        let result;

        while (retryCount < maxRetries) {
            try {
                result = await model.generateContent({
                    contents: [
                        ...chatHistory,
                        { role: "user", parts: [{ text: systemInstruction }] }
                    ]
                });
                break; // Success
            } catch (apiError: any) {
                if ((apiError.status === 503 || apiError.status === 429) && retryCount < maxRetries - 1) {
                    console.warn(`API Error ${apiError.status}, retrying (${retryCount + 1}/${maxRetries})...`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 4000 * Math.pow(2, retryCount))); // Increased backoff to 4s, 8s, 16s
                } else {
                    throw apiError;
                }
            }
        }

        if (!result) throw new Error("Failed to generate content after retries");

        const responseText = result.response.text();

        // Check for [JUMP_TO: ...] tag
        const jumpMatch = responseText.match(/\[JUMP_TO:\s*(.+?)\]/);
        if (jumpMatch) {
            const targetBeatName = jumpMatch[1];
            // Validate if the beat exists in the current structure
            const targetBeat = beats.find(b => b.name === targetBeatName);
            if (targetBeat) {
                // We will handle the actual state update on the client side or next request, 
                // but for now, we just pass the response. 
                // Ideally, the client should parse this or we update the state here if we were persisting it server-side.
                // Since state is passed back and forth, we can't update it here directly for the *next* request 
                // unless we return the updated state.
                // For this architecture, we'll append a special instruction for the client or just let the game engine handle it next turn?
                // Actually, the game engine runs *before* this API call to set up the state. 
                // The API call generates the response. 
                // If we want to jump, we need to tell the client to update the state.
                // Let's assume the client will send the *response* back to the game engine? 
                // No, the client receives the response and displays it.
                // The *next* turn, the client sends the history.
                // We need a way to signal the state change.
                // Let's append a hidden command that the client (or next engine run) can interpret?
                // Or better: The `processTurn` in `game-engine.ts` should handle this if it was running the AI.
                // But `processTurn` runs locally. This API runs on server.
                // We'll leave the tag in the text. The client needs to parse it?
                // For simplicity in this text-adventure, we might just let the *next* turn's prompt see the tag in history and adjust?
                // No, `game-engine` determines the beat based on turn count.
                // We need to override the turn count or beat.

                // Let's return a special property in the JSON if possible, or just let the tag pass through 
                // and have the client's `handleSubmit` logic handle it?
                // The current architecture seems to be: Client calls API -> API returns text -> Client updates history.
                // The `game-engine` calculates state based on inputs.
                // To support this properly, we might need to return `updatedState` from the API, but `processTurn` is client-side.

                // Workaround: We will return the tag as part of the message. 
                // The `game-engine` needs to be updated to scan the *last message* for [JUMP_TO] tags and adjust the state.
            }
        }

        return NextResponse.json({ message: responseText });

    } catch (error) {
        console.error("Error generating content:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}
