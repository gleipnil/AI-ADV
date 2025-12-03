import { BeatName } from "./types";

export const SAVE_THE_CAT_BEATS: Record<BeatName, { description: string; turnRange: [number, number] }> = {
    "Opening Image": {
        description: "Establish the status quo. Show the hero's ordinary world and their flaw/lack.",
        turnRange: [1, 2],
    },
    "Theme Stated": {
        description: "Hint at the lesson the hero needs to learn (the theme).",
        turnRange: [3, 3],
    },
    "Set-up": {
        description: "Explore the ordinary world further, highlighting the stakes and the hero's reluctance or need for change.",
        turnRange: [4, 5],
    },
    "Catalyst": {
        description: "The inciting incident. Something happens that disrupts the status quo.",
        turnRange: [6, 6],
    },
    "Debate": {
        description: "The hero doubts the journey. Can I do this? Should I go?",
        turnRange: [7, 8],
    },
    "Break into Two": {
        description: "The hero makes a choice to leave the ordinary world and enter the special world.",
        turnRange: [9, 9],
    },
    "B Story": {
        description: "Introduction of a relationship character (ally, mentor, love interest) who represents the theme.",
        turnRange: [10, 11],
    },
    "Fun and Games": {
        description: "The promise of the premise. The hero explores the new world, succeeding or failing in entertaining ways.",
        turnRange: [12, 16],
    },
    "Midpoint": {
        description: "A major event that raises the stakes. False victory or false defeat.",
        turnRange: [17, 17],
    },
    "Bad Guys Close In": {
        description: "The forces of antagonism regroup and push back hard. The hero struggles.",
        turnRange: [18, 22],
    },
    "All Is Lost": {
        description: "The lowest point. The hero loses something vital. Hope seems gone.",
        turnRange: [23, 23],
    },
    "Dark Night of the Soul": {
        description: "The hero reflects on the loss and finds the strength/truth to continue.",
        turnRange: [24, 25],
    },
    "Break into Three": {
        description: "The hero realizes the solution (incorporating the theme) and decides to fight.",
        turnRange: [26, 26],
    },
    "Finale": {
        description: "The final showdown. The hero proves they have changed.",
        turnRange: [27, 30],
    },
    "Final Image": {
        description: "The aftermath. Show how the hero has changed compared to the Opening Image.",
        turnRange: [31, 32],
    },
};

export function getBeatForTurn(turn: number): BeatName {
    for (const [beat, data] of Object.entries(SAVE_THE_CAT_BEATS)) {
        if (turn >= data.turnRange[0] && turn <= data.turnRange[1]) {
            return beat as BeatName;
        }
    }
    return "Final Image"; // Default to end if over
}
