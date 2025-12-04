"use client";

import { useState, useEffect, useRef } from "react";
import { PERSONALITIES } from "@/lib/personalities";
import { createInitialState, processTurn, processAIResponse, GM_SPECIAL_CHOICES } from "@/lib/game-engine";
import { GameState } from "@/lib/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [retryData, setRetryData] = useState<{ input: string; state: GameState } | null>(null);
  const [history, setHistory] = useState<string[]>([
    "INITIALIZING SYSTEM...",
    "LOADING NARRATIVE MODULES...",
    ...Object.values(PERSONALITIES).map(p =>
      ` > MODULE '${p.id.toUpperCase()}' [${p.isHidden ? "STANDBY" : "OK"}]`
    ),
    "CONNECTING TO NEURAL LINK...",
    "CONNECTION ESTABLISHED.",
    "",
    "AIアドベンチャーゲームへようこそ。",
    "世界はまだ形を成しておらず、あなたの入力を待っています。",
    "",
    "どこから物語を始めますか？",
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize game state on mount
  useEffect(() => {
    setGameState(createInitialState());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]); // Scroll when loading state changes too

  const sendToAPI = async (userInput: string, currentState: GameState) => {
    setIsLoading(true);
    setRetryData(null); // Clear previous retry data

    // Select thinking message based on current GM
    const currentGM = PERSONALITIES[currentState.currentGMId];
    if (currentGM && currentGM.thinkingMessages) {
      const randomMsg = currentGM.thinkingMessages[Math.floor(Math.random() * currentGM.thinkingMessages.length)];
      setThinkingMessage(randomMsg);
    } else {
      setThinkingMessage("GM is thinking...");
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: userInput, gameState: currentState }),
      });

      if (!response.ok) throw new Error("API Error");

      const data = await response.json();
      let messageContent = data.message;
      let isStagnant = false;

      // Check for hidden stagnation tag
      if (messageContent.includes("[STAGNATION]")) {
        isStagnant = true;
        messageContent = messageContent.replace("[STAGNATION]", "").trim();
      }

      let newStatus = "active";
      if (messageContent.includes("[THE_END]")) {
        newStatus = "completed";
        messageContent = messageContent.replace("[THE_END]", "").trim();
      } else if (messageContent.includes("[GAME_OVER]")) {
        newStatus = "game_over";
        messageContent = messageContent.replace("[GAME_OVER]", "").trim();
      }

      // Check for GM Recommendation
      let nextGMId = currentState.currentGMId;
      const gmMatch = messageContent.match(/\[RECOMMEND_GM:\s*(\w+)\]/);
      if (gmMatch) {
        const recommendedId = gmMatch[1].toLowerCase();
        if (PERSONALITIES[recommendedId] && recommendedId !== currentState.currentGMId) {
          nextGMId = recommendedId;
          // Remove the tag from display
          messageContent = messageContent.replace(gmMatch[0], "").trim();

          // Add switch message
          const newGM = PERSONALITIES[nextGMId];
          let switchMsg = "";
          if (newGM.isHidden) {
            switchMsg = `\n⚠ WARNING: UNKNOWN SIGNAL DETECTED.\n>> ${newGM.name} が乱入しました！\n`;
          } else {
            switchMsg = `\n>> ${newGM.name} が興味を示しました。\n`;
          }
          // Prepend switch message to the AI response content for display
          messageContent = switchMsg + messageContent;
        } else {
          // Just remove the tag if no switch or invalid GM
          messageContent = messageContent.replace(gmMatch[0], "").trim();
        }
      }

      setHistory((prev) => [...prev, messageContent]);

      // Update history in state for context in next turn
      setGameState(prev => {
        if (!prev) return null;

        let updatedState = {
          ...prev,
          status: newStatus as any,
          stagnationCount: isStagnant ? prev.stagnationCount + 1 : 0, // Increment or reset
          currentGMId: nextGMId, // Update GM
          history: [
            ...prev.history,
            { role: "user" as const, content: userInput },
            { role: "model" as const, content: messageContent }
          ]
        };

        // Process AI response for special tags like [JUMP_TO]
        updatedState = processAIResponse(updatedState, data.message);

        return updatedState;
      });

    } catch (error) {
      console.error(error);
      setHistory((prev) => [...prev, "⚠ COMMUNICATION ERROR: Neural Link Severed."]);
      // Save data for retry
      setRetryData({ input: userInput, state: currentState });
    } finally {
      setIsLoading(false);
      setThinkingMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState) return;

    const userInput = input;
    setInput(""); // Clear input immediately

    // Debug Command: Q
    if (userInput.toUpperCase() === "Q") {
      const debugInfo = [
        "=== DEBUG INFO ===",
        `Turn: ${gameState.turnCount}`,
        `Structure: ${gameState.currentStructure}`,
        `Beat: ${gameState.currentBeat}`,
        `Current GM: ${gameState.currentGMId}`,
        `Stagnation: ${gameState.stagnationCount}`,
        `Karma: ${gameState.player.karma}`,
        `Inventory: ${gameState.player.inventory.join(", ") || "None"}`,
        "GM Affinity:",
        ...Object.entries(gameState.gmAffinity).map(([id, score]) => `  - ${id}: ${score}`),
        "=================="
      ].join("\n");

      setHistory((prev) => [...prev, `> ${userInput}`, debugInfo]);
      return; // Early return, do not process turn or call API
    }

    // Add user input to history
    setHistory((prev) => [...prev, `> ${userInput}`]);

    // Process turn (Local Logic for GM switching & Beat update)
    const { newState, messages: localMessages } = processTurn(userInput, gameState);

    // Display local messages (like GM switch warnings) immediately
    if (localMessages.length > 0) {
      const systemMessages = localMessages.filter(m => m.startsWith("\n⚠") || m.startsWith("\n>>") || m.startsWith("\n==="));
      setHistory((prev) => [...prev, ...systemMessages]);
    }

    setGameState(newState);
    await sendToAPI(userInput, newState);
  };

  const handleRetry = async () => {
    if (!retryData) return;
    // Remove the last error message from history to keep it clean
    setHistory((prev) => prev.slice(0, -1));
    await sendToAPI(retryData.input, retryData.state);
  };

  const handleRestart = () => {
    setGameState(createInitialState());
    setHistory([
      "SYSTEM REBOOT...",
      "LOADING NARRATIVE MODULES...",
      ...Object.values(PERSONALITIES).map(p =>
        ` > MODULE '${p.id.toUpperCase()}' [${p.isHidden ? "STANDBY" : "OK"}]`
      ),
      "CONNECTING TO NEURAL LINK...",
      "CONNECTION ESTABLISHED.",
      "",
      "AIアドベンチャーゲームへようこそ。",
      "世界はまだ形を成しておらず、あなたの入力を待っています。",
      "",
      "どこから物語を始めますか？",
    ]);
    setInput("");
    setRetryData(null);
  };

  const handleFunctionKey = async (actionId: string, label: string) => {
    if (!gameState) return;

    // F1: LOOK (Free Action)
    if (actionId === "look") {
      setHistory((prev) => [...prev, `> ${label}`]);
      setIsLoading(true);
      setThinkingMessage("OBSERVING...");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: "周囲を詳しく観察する",
            gameState: gameState,
            mode: "inspection" // Special mode for free action
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        setHistory((prev) => [...prev, data.message]);
      } catch (error) {
        console.error(error);
        setHistory((prev) => [...prev, "⚠ SENSOR ERROR: Visual feed interrupted."]);
      } finally {
        setIsLoading(false);
        setThinkingMessage("");
      }
      return;
    }

    // F3: ITEM (Free Action - Local)
    if (actionId === "item") {
      setHistory((prev) => [...prev, `> ${label}`]);
      const inventoryList = gameState.player.inventory.length > 0
        ? gameState.player.inventory.join(", ")
        : "Nothing.";
      setHistory((prev) => [...prev, `[INVENTORY]: ${inventoryList}`]);
      return;
    }

    // Other Actions (Consume Turn)
    let input = "";
    switch (actionId) {
      case "talk": input = "近くの誰かに話しかける"; break;
      // case "item": input = "持ち物を確認する"; break; // Moved to free action
      case "gm1": input = label; break; // GM Action 1
      case "gm2": input = label; break; // GM Action 2
      default: return;
    }

    // Execute as normal input
    setInput(input); // Set input for visual feedback if needed, or just pass directly
    // We need to trigger handleSubmit-like logic.
    // Since handleSubmit uses the 'input' state, we can't just call it directly easily without setting state and waiting.
    // So we'll duplicate the core logic or extract it. 
    // For simplicity, let's just call the internal logic directly.

    setHistory((prev) => [...prev, `> ${input}`]);
    const { newState, messages: localMessages } = processTurn(input, gameState);
    if (localMessages.length > 0) {
      const systemMessages = localMessages.filter(m => m.startsWith("\n⚠") || m.startsWith("\n>>") || m.startsWith("\n==="));
      setHistory((prev) => [...prev, ...systemMessages]);
    }
    setGameState(newState);
    await sendToAPI(input, newState);
  };

  // Get current GM's special actions
  const gmSpecials = gameState ? GM_SPECIAL_CHOICES[gameState.currentGMId] || [] : [];
  const special1 = gmSpecials[0];
  const special2 = gmSpecials[1];

  return (
    <div className="crt-container">
      <div className="crt-overlay" />
      <div className="terminal-content pb-16">
        {gameState && (
          <div className="fixed top-4 right-4 text-green-500 opacity-50 pointer-events-none">
            TURN: {gameState.turnCount}
          </div>
        )}
        {history.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap mb-1">
            {line}
          </div>
        ))}
        {gameState?.status === "active" ? (
          isLoading ? (
            <div className="mt-4 animate-pulse text-green-400">
              {thinkingMessage || "PROCESSING..."}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-row items-center mt-4">
              <span className="mr-2">{">"}</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-transparent border-none outline-none text-white w-full"
                autoFocus
                placeholder="What will you do?"
              />
            </form>
          )
        ) : (
          <div className="mt-4 text-green-500">
            {gameState?.status === "completed" ? ">> MISSION ACCOMPLISHED." :
              gameState?.status === "game_over" ? ">> CRITICAL FAILURE." : ""}
            <button
              onClick={handleRestart}
              className="block mt-4 border border-green-500 px-4 py-2 hover:bg-green-900"
            >
              SYSTEM REBOOT
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Function Key Bar */}
      {gameState?.status === "active" && !isLoading && (
        <div className="fixed bottom-0 left-0 w-full bg-black border-t-2 border-green-900 flex flex-row justify-start items-center p-1 gap-1 overflow-x-auto z-50">
          <FunctionKey label="LOOK" onClick={() => handleFunctionKey("look", "周囲を見る")} />
          <FunctionKey label="TALK" onClick={() => handleFunctionKey("talk", "話しかける")} />
          <FunctionKey label="ITEM" onClick={() => handleFunctionKey("item", "持ち物")} />
          {special1 && (
            <FunctionKey label={special1.label.toUpperCase()} onClick={() => handleFunctionKey("gm1", special1.label)} />
          )}
          {special2 && (
            <FunctionKey label={special2.label.toUpperCase()} onClick={() => handleFunctionKey("gm2", special2.label)} />
          )}
        </div>
      )}
    </div>
  );
}

// Helper Component for Function Keys
const FunctionKey = ({ label, onClick }: { label: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="bg-gray-200 text-black font-bold font-mono px-3 py-1 text-sm hover:bg-white active:bg-gray-400 min-w-[80px]"
  >
    {label}
  </button>
);
