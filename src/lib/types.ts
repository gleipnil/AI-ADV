export type BeatName =
    | "Opening Image"
    | "Theme Stated"
    | "Set-up"
    | "Catalyst"
    | "Debate"
    | "Break into Two"
    | "B Story"
    | "Fun and Games"
    | "Midpoint"
    | "Bad Guys Close In"
    | "All Is Lost"
    | "Dark Night of the Soul"
    | "Break into Three"
    | "Finale"
    | "Final Image";

export interface PlayerProfile {
    name: string;
    karma: number; // 0-100, higher is worse/more chaotic
    inventory: string[];
    status: string;
    traits: string[];
}

export interface Choice {
    id: string; // e.g., "y", "n", "a"
    label: string; // e.g., "Yes", "No", "Attack"
    description?: string; // e.g., "正面から突撃する"
    gmId?: string; // どのGMの提案か
}

export interface GameState {
    status: "active" | "game_over" | "completed";
    turnCount: number;
    stagnationCount: number; // Tracks how many turns the story has stalled
    currentBeat: string;
    currentStructure: string;
    currentGMId: string;
    currentChoices: Choice[];
    player: PlayerProfile;
    storySummary: string;
    hiddenObjectives: string[];
    history: {
        role: "user" | "model";
        content: string;
    }[];
    gmAffinity: Record<string, number>;
}
