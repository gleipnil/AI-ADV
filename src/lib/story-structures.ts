export type StoryStructureName = "save_the_cat" | "story_circle" | "kishotenketsu";

export interface BeatDefinition {
    name: string;
    description: string;
    turnRange: [number, number]; // Relative turn range within the structure
    progress: number; // 0.0 to 1.0, approximate progress through the story
}

export const STORY_STRUCTURES: Record<StoryStructureName, BeatDefinition[]> = {
    save_the_cat: [
        { name: "Opening Image", description: "Establish the status quo.", turnRange: [1, 2], progress: 0.05 },
        { name: "Theme Stated", description: "Hint at the lesson.", turnRange: [3, 3], progress: 0.1 },
        { name: "Set-up", description: "Explore the ordinary world.", turnRange: [4, 5], progress: 0.15 },
        { name: "Catalyst", description: "The inciting incident.", turnRange: [6, 6], progress: 0.2 },
        { name: "Debate", description: "The hero doubts the journey.", turnRange: [7, 8], progress: 0.25 },
        { name: "Break into Two", description: "Enter the special world.", turnRange: [9, 9], progress: 0.3 },
        { name: "B Story", description: "Introduction of a relationship character.", turnRange: [10, 11], progress: 0.35 },
        { name: "Fun and Games", description: "The promise of the premise.", turnRange: [12, 16], progress: 0.5 },
        { name: "Midpoint", description: "A major event. False victory/defeat.", turnRange: [17, 17], progress: 0.55 },
        { name: "Bad Guys Close In", description: "The forces of antagonism regroup.", turnRange: [18, 22], progress: 0.7 },
        { name: "All Is Lost", description: "The lowest point.", turnRange: [23, 23], progress: 0.75 },
        { name: "Dark Night of the Soul", description: "Reflection and finding strength.", turnRange: [24, 25], progress: 0.8 },
        { name: "Break into Three", description: "Realization and decision to fight.", turnRange: [26, 26], progress: 0.85 },
        { name: "Finale", description: "The final showdown.", turnRange: [27, 30], progress: 0.95 },
        { name: "Final Image", description: "The aftermath.", turnRange: [31, 32], progress: 1.0 },
    ],
    story_circle: [
        { name: "1. You", description: "A character is in a zone of comfort.", turnRange: [1, 2], progress: 0.1 },
        { name: "2. Need", description: "But they want something.", turnRange: [3, 3], progress: 0.2 },
        { name: "3. Go", description: "They enter an unfamiliar situation.", turnRange: [4, 4], progress: 0.3 },
        { name: "4. Search", description: "Adapt to it.", turnRange: [5, 6], progress: 0.5 },
        { name: "5. Find", description: "Get what they wanted.", turnRange: [7, 7], progress: 0.6 },
        { name: "6. Take", description: "Pay a heavy price for it.", turnRange: [8, 8], progress: 0.75 },
        { name: "7. Return", description: "Then return to their familiar situation.", turnRange: [9, 10], progress: 0.9 },
        { name: "8. Change", description: "Having changed.", turnRange: [11, 12], progress: 1.0 },
    ],
    kishotenketsu: [
        { name: "Ki (Introduction)", description: "Introduction of characters and setting.", turnRange: [1, 4], progress: 0.2 },
        { name: "Sho (Development)", description: "Development of the plot. Clues are gathered.", turnRange: [5, 8], progress: 0.5 },
        { name: "Ten (Twist)", description: "The twist. An unexpected turn of events or revelation.", turnRange: [9, 12], progress: 0.8 },
        { name: "Ketsu (Conclusion)", description: "The conclusion. Wrapping up loose ends.", turnRange: [13, 16], progress: 1.0 },
    ]
};

export function getBeatForProgress(structure: StoryStructureName, progress: number): BeatDefinition {
    const beats = STORY_STRUCTURES[structure];
    // Find the beat with the closest progress value
    return beats.reduce((prev, curr) =>
        Math.abs(curr.progress - progress) < Math.abs(prev.progress - progress) ? curr : prev
    );
}

export function getBeatForTurn(structure: StoryStructureName, turn: number): BeatDefinition {
    const beats = STORY_STRUCTURES[structure];
    for (const beat of beats) {
        if (turn >= beat.turnRange[0] && turn <= beat.turnRange[1]) {
            return beat;
        }
    }
    return beats[beats.length - 1]; // Default to last beat
}
