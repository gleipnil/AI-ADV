"use client";

import { useState, useEffect, useRef } from "react";
import { PERSONALITIES } from "@/lib/personalities";
import { createInitialState, processTurn, processAIResponse } from "@/lib/game-engine";
import { GameState } from "@/lib/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
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
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !gameState) return;

    const userInput = input;
    setInput(""); // Clear input immediately

    // Add user input to history
    setHistory((prev) => [...prev, `> ${userInput}`]);

    // Process turn (Local Logic for GM switching & Beat update)
    // We still use local logic to determine GM switch before asking AI, 
    // or we could let AI decide. For now, let's keep local logic for state updates
    // and pass the *updated* state to the AI.

    const { newState, messages: localMessages } = processTurn(userInput, gameState);

    // Display local messages (like GM switch warnings) immediately
    if (localMessages.length > 0) {
      // Filter out the mock flavor text and choices from local engine, keep only system messages
      // This is a bit hacky, ideally we separate logic. 
      // For now, let's just use the AI response for the main content.
      const systemMessages = localMessages.filter(m => m.startsWith("\n⚠") || m.startsWith("\n>>") || m.startsWith("\n==="));
      setHistory((prev) => [...prev, ...systemMessages]);
    }

    setGameState(newState);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: userInput, gameState: newState }),
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

      setHistory((prev) => [...prev, messageContent]);

      // Update history in state for context in next turn
      setGameState(prev => {
        if (!prev) return null;

        let updatedState = {
          ...prev,
          status: newStatus as any,
          stagnationCount: isStagnant ? prev.stagnationCount + 1 : 0, // Increment or reset
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
    }
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
  };

  return (
    <div className="crt-container">
      <div className="crt-overlay" />
      <div className="terminal-content">
        {history.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap mb-1">
            {line}
          </div>
        ))}

        {gameState?.status === "active" ? (
          <form onSubmit={handleSubmit} className="flex flex-row items-center mt-4">
            <span className="mr-2">{">"}</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="terminal-input flex-1"
              autoFocus
              spellCheck={false}
            />
          </form>
        ) : (
          <div className="mt-8 text-center">
            <h1 className="text-4xl font-bold mb-4 glitch-text">
              {gameState?.status === "completed" ? "THE END" : "GAME OVER"}
            </h1>
            <button
              onClick={handleRestart}
              className="border-2 border-green-500 px-6 py-2 hover:bg-green-500 hover:text-black transition-colors terminal-font"
            >
              RESTART SYSTEM
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
