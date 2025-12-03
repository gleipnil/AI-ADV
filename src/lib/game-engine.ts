import { PERSONALITIES } from "./personalities";
import { getBeatForTurn, getBeatForProgress, STORY_STRUCTURES, StoryStructureName } from "./story-structures";
import { GameState } from "./types";

// キーワードによるGMの反応定義
const GM_TRIGGERS: Record<string, string[]> = {
    warlord: ["戦う", "攻撃", "剣", "殺す", "軍", "戦争", "殴る", "破壊"],
    detective: ["推理", "証拠", "謎", "調べる", "尋問", "論理", "犯人", "トリック"],
    jester: ["笑う", "踊る", "盗む", "嘘", "冗談", "イタズラ", "狂う", "遊ぶ"],
    bard: ["歌う", "詩", "泣く", "祈る", "美しい", "祈り", "犠牲", "守る"],
    storyteller: ["怖い", "暗い", "音", "幽霊", "呪い", "死", "逃げる", "隠れる", "怪談", "恐怖"],
    cyberpunk: ["ハッキング", "コード", "電脳", "ネットワーク", "インストール", "バグ", "AI", "未来"],
    madgod: ["リセット", "デバッグ", "GM", "システム", "終了", "コンソール", "メタ"],
};

export function createInitialState(): GameState {
    return {
        status: "active",
        turnCount: 1,
        stagnationCount: 0,
        currentBeat: "Opening Image",
        currentStructure: "save_the_cat",
        currentGMId: "guide",
        gmAffinity: {
            historian: 0,
            warlord: 0,
            jester: 0,
            bard: 0,
            detective: 0,
            storyteller: 0,
            cyberpunk: 0,
            madgod: 0,
        },
        currentChoices: [
            { id: "l", label: "Look around", description: "周囲を観察する" },
            { id: "w", label: "Wait", description: "様子を見る" }
        ],
        player: {
            name: "Player",
            karma: 50,
            inventory: [],
            status: "Normal",
            traits: [],
        },
        storySummary: "物語が始まります。",
        hiddenObjectives: [],
        history: [],
    };
}

// GMごとの特殊選択肢定義
const GM_SPECIAL_CHOICES: Record<string, { id: string; label: string; description: string }[]> = {
    guide: [
        { id: "l", label: "Look", description: "周囲をよく見る" },
        { id: "m", label: "Move", description: "先に進む" }
    ],
    historian: [
        { id: "o", label: "Observe", description: "歴史的背景を考察する" },
        { id: "r", label: "Record", description: "記録に残す" }
    ],
    warlord: [
        { id: "a", label: "Attack", description: "問答無用で殴りかかる" },
        { id: "c", label: "Charge", description: "雄叫びを上げて突撃する" },
        { id: "i", label: "Intimidate", description: "威圧して屈服させる" }
    ],
    jester: [
        { id: "m", label: "Mock", description: "相手を小馬鹿にする" },
        { id: "d", label: "Dance", description: "意味もなく踊り出す" },
        { id: "p", label: "Prank", description: "パイを投げつける" }
    ],
    detective: [
        { id: "i", label: "Investigate", description: "徹底的に調べる" },
        { id: "d", label: "Deduce", description: "推理を披露する" },
        { id: "q", label: "Question", description: "相手を尋問する" }
    ],
    bard: [
        { id: "p", label: "Poem", description: "即興で詩を詠む" },
        { id: "s", label: "Sing", description: "感情を込めて歌う" },
        { id: "l", label: "Lament", description: "世界の悲劇を嘆く" }
    ],
    storyteller: [
        { id: "l", label: "Listen", description: "耳を澄ます" },
        { id: "s", label: "Sense", description: "気配を探る" }
    ],
    cyberpunk: [
        { id: "h", label: "Hack", description: "現実をハッキングする" },
        { id: "s", label: "Scan", description: "生体情報をスキャンする" }
    ],
    madgod: [
        { id: "g", label: "Glitch", description: "バグを利用する" },
        { id: "r", label: "Rewrite", description: "スクリプトを書き換える" }
    ]
};

const COMMON_CHOICES = [
    { id: "n", label: "North", description: "北へ進む" },
    { id: "s", label: "South", description: "南へ進む" },
    { id: "e", label: "East", description: "東へ進む" },
    { id: "w", label: "West", description: "西へ進む" },
    { id: "y", label: "Yes", description: "肯定する" },
    { id: "n", label: "No", description: "否定する" }, // ID重複注意: 文脈で使い分けるか、固定セットにする
    { id: "l", label: "Look", description: "調べる" },
    { id: "t", label: "Talk", description: "話しかける" },
];

export function processTurn(input: string, state: GameState): { newState: GameState; messages: string[] } {
    let newState = { ...state };
    const messages: string[] = [];
    let processedInput = input;

    // 1. 選択肢入力の判定 (Choice Resolution)
    let matchedChoice;
    const lowerInput = input.toLowerCase().trim();

    // 1文字のアルファベット入力の場合はID完全一致を優先して検索
    if (lowerInput.length === 1 && /^[a-z]$/.test(lowerInput)) {
        matchedChoice = state.currentChoices.find(c => c.id.toLowerCase() === lowerInput);
    }

    // マッチしなかった、または1文字でない場合は従来通り（IDまたはラベルの完全一致）
    if (!matchedChoice) {
        matchedChoice = state.currentChoices.find(c =>
            c.id.toLowerCase() === lowerInput ||
            c.label.toLowerCase() === lowerInput
        );
    }

    if (matchedChoice) {
        processedInput = `${matchedChoice.label} (${matchedChoice.description || ""})`;
        // 選択肢が選ばれた場合、そのアクションを実行したことにする
    }

    // 2. GMの切り替え判定 (Determine GM Switch)
    // 選択肢によるアクションもキーワードとして扱う
    let nextGMId = newState.currentGMId;
    let gmSwitchMessage = "";

    // イントロ期間 (Turn 1-3)
    if (newState.turnCount <= 3 && newState.currentGMId === "guide") {
        // キーワードに基づいて親和性を更新
        for (const [gmId, keywords] of Object.entries(GM_TRIGGERS)) {
            if (keywords.some(k => processedInput.includes(k))) {
                newState.gmAffinity[gmId] = (newState.gmAffinity[gmId] || 0) + 1;
            }
        }

        // 3ターン目終了時に交代
        if (newState.turnCount === 3) {
            // Find max affinity
            let maxAffinity = -1;
            let bestGM = "historian";

            for (const [gmId, score] of Object.entries(newState.gmAffinity)) {
                if (score > maxAffinity) {
                    maxAffinity = score;
                    bestGM = gmId;
                }
            }

            // If no specific affinity was built (all 0), choose randomly from the 4 main GMs
            if (maxAffinity === 0) {
                const defaultGMs = ["historian", "jester", "bard", "warlord"];
                bestGM = defaultGMs[Math.floor(Math.random() * defaultGMs.length)];
            }

            nextGMId = bestGM;
            const gm = PERSONALITIES[nextGMId];
            gmSwitchMessage = `\n>> 案内人: 「ふむ、あなたの傾向はよく分かりました。ここからは彼に任せましょう。」\n>> ${gm.name} が物語を引き継ぎました。\n`;
        }
    } else {
        // 通常の交代ロジック (Turn > 3 or not guide)
        for (const [gmId, keywords] of Object.entries(GM_TRIGGERS)) {
            if (keywords.some(k => processedInput.includes(k))) {
                if (newState.currentGMId !== gmId) {
                    nextGMId = gmId;
                    const gm = PERSONALITIES[gmId];
                    if (gm.isHidden) {
                        gmSwitchMessage = `\n⚠ WARNING: UNKNOWN SIGNAL DETECTED.\n>> ${gm.name} が乱入しました！\n`;
                    } else {
                        gmSwitchMessage = `\n>> ${gm.name} が興味を示しました。\n`;
                    }
                }
                break; // 最初のマッチで決定
            }
        }
    }

    newState.currentGMId = nextGMId;
    const currentGM = PERSONALITIES[newState.currentGMId];

    // 2.5 構造の切り替え判定 (Structure Switching)
    // 新しいGMの好む構造が現在と異なる場合、構造を切り替える
    if (currentGM.preferredStructure && currentGM.preferredStructure !== newState.currentStructure) {
        const oldStructureName = newState.currentStructure as StoryStructureName;
        const newStructureName = currentGM.preferredStructure as StoryStructureName;

        // 現在のビートの進捗率を取得
        const oldBeats = STORY_STRUCTURES[oldStructureName];
        const currentBeatDef = oldBeats.find(b => b.name === newState.currentBeat) || oldBeats[0];
        const currentProgress = currentBeatDef.progress;

        // 新しい構造で最も近い進捗率のビートを取得
        const newBeatDef = getBeatForProgress(newStructureName, currentProgress);

        newState.currentStructure = newStructureName;
        newState.currentBeat = newBeatDef.name;

        // ターン数はそのままだが、ビートの意味合いが変わる
        messages.push(`\n>> 物語の構造が『${newStructureName}』に変化しました。\n`);
    }

    // 3. ビートの更新 (Update Beat)
    newState.turnCount += 1;
    const newBeatDef = getBeatForTurn(newState.currentStructure as StoryStructureName, newState.turnCount);
    const newBeat = newBeatDef.name;

    if (newBeat !== newState.currentBeat) {
        newState.currentBeat = newBeat;
        messages.push(`\n=== SCENE ${newState.turnCount}: ${newBeat.toUpperCase()} ===\n[${newBeatDef.description}]\n`);
    }

    // 4. GM交代メッセージがあれば追加
    if (gmSwitchMessage) {
        messages.push(gmSwitchMessage);
    }

    // 5. モックレスポンス生成 (Generate Mock Response)
    const mockResponses = [
        "なるほど、そう来ましたか。",
        "それは予想外の展開です。",
        "運命の歯車が回り始めました。",
        "しかし、それは賢明な選択でしょうか？",
        "世界がその行動に反応しています。",
    ];

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];

    let flavorText = "";
    // GMごとの口調生成（省略せず記述）
    switch (newState.currentGMId) {
        case "historian":
            flavorText = `歴史家: 「記録によれば、${processedInput}という行動は...ふむ、${randomResponse}」`;
            break;
        case "jester":
            flavorText = `道化師: 「ヒャハハ！ ${processedInput}だって！？ 最高だね！ ${randomResponse}」`;
            break;
        case "warlord":
            flavorText = `将軍: 「${processedInput}だと！？ 軟弱な！ もっと血を見せろ！ ...だが、${randomResponse}」`;
            break;
        case "guide":
            flavorText = `案内人: 「${processedInput}ですね。承知しました。${randomResponse}」`;
            break;
        case "detective":
            flavorText = `探偵: 「${processedInput}か...。それが意味することは一つだ。${randomResponse}」`;
            break;
        case "bard":
            flavorText = `詩人: 「ああ、${processedInput}... なんて悲劇的で美しい響きでしょう。${randomResponse}」`;
            break;
        case "storyteller":
            flavorText = `怪談師: 「${processedInput}... ふふふ、聞こえますか？ ${randomResponse}」`;
            break;
        case "cyberpunk":
            flavorText = `パンク野郎: 「${processedInput}... ソースコードに干渉してるな。${randomResponse}」`;
            break;
        case "madgod":
            flavorText = `狂神: 「${processedInput}... ほう、君はまだ自分がプレイヤーだと思っているのか？ ${randomResponse}」`;
            break;
        default:
            flavorText = `GM: 「${processedInput}... ${randomResponse}」`;
    }

    messages.push(flavorText);

    // 6. 次の選択肢を生成 (Generate Next Choices)
    // 基本選択肢からランダムに2つ + GM固有の選択肢1つ
    const nextChoices = [];

    // ランダムな基本選択肢
    const shuffledCommon = [...COMMON_CHOICES].sort(() => 0.5 - Math.random());
    nextChoices.push(shuffledCommon[0]);
    nextChoices.push(shuffledCommon[1]);

    // GM固有の選択肢
    const gmSpecials = GM_SPECIAL_CHOICES[newState.currentGMId];
    if (gmSpecials) {
        const randomSpecial = gmSpecials[Math.floor(Math.random() * gmSpecials.length)];
        nextChoices.push({ ...randomSpecial, gmId: newState.currentGMId });
    }

    // IDの重複を避けるための簡易処理（本来はもっと厳密にやるべき）
    // 今回は表示順で区別できるのでそのままにするが、入力判定では先頭マッチになる

    newState.currentChoices = nextChoices;

    // 選択肢の表示テキストを作成
    const choiceText = "\n" + nextChoices.map(c =>
        `[${c.id.toUpperCase()}] ${c.label}${c.description ? ` - ${c.description}` : ""}`
    ).join("\n");

    messages.push(choiceText);

    // 状態の保存（履歴など）
    newState.history = [
        ...newState.history,
        { role: "user", content: processedInput },
        { role: "model", content: flavorText + choiceText }
    ];

    return { newState, messages };
}

export function processAIResponse(state: GameState, aiResponse: string): GameState {
    let newState = { ...state };

    // Check for [JUMP_TO: ...] tag
    const jumpMatch = aiResponse.match(/\[JUMP_TO:\s*(.+?)\]/);
    if (jumpMatch) {
        const targetBeatName = jumpMatch[1];
        const beats = STORY_STRUCTURES[newState.currentStructure as StoryStructureName];
        const targetBeat = beats.find(b => b.name === targetBeatName);

        if (targetBeat) {
            newState.currentBeat = targetBeat.name;
            // Update turn count to the start of the new beat to keep sync
            newState.turnCount = targetBeat.turnRange[0];
            // Note: This might cause a jump in turn count, which is intended.
        }
    }

    return newState;
}
