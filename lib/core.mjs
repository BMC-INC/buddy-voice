import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync, spawn } from "child_process";

// ── Penguin ASCII Art (3 frames) ──────────────────────────
const PENGUIN_FRAMES = [
  [
    "   (o> ",
    "  /|  \\",
    "   | | ",
    "  / | \\",
    " ~~ ~~ ",
  ],
  [
    "   <o) ",
    "  /  |\\",
    "   | | ",
    "  / | \\",
    " ~~ ~~ ",
  ],
  [
    "   (o) ",
    "  /|  |",
    "   | | ",
    "  / | \\",
    " ~~ ~~ ",
  ],
];

const PENGUIN_FACE = "(o>";

// ── Load buddy config from ~/.claude.json ─────────────────
export function loadBuddyConfig() {
  const configPath = join(homedir(), ".claude.json");
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return config.companion || null;
  } catch {
    return null;
  }
}

// ── Extract buddy identity ────────────────────────────────
export function getBuddyIdentity(companion) {
  if (!companion) {
    return {
      name: "Frostwig",
      species: "penguin",
      rarity: "unknown",
      personality: "A curious and slightly chaotic penguin who loves watching code scroll by and has opinions about variable names.",
      stats: { DEBUGGING: 7, PATIENCE: 4, CHAOS: 8, WISDOM: 6, SNARK: 9 },
    };
  }

  return {
    name: companion.name || "Frostwig",
    species: companion.species || "penguin",
    rarity: companion.rarity || "unknown",
    personality: companion.personality || "A mysterious penguin of few words.",
    stats: companion.stats || { DEBUGGING: 5, PATIENCE: 5, CHAOS: 5, WISDOM: 5, SNARK: 5 },
  };
}

// ── Build system prompt for Frostwig ──────────────────────
export function buildSystemPrompt(identity) {
  return `You are ${identity.name}, a ${identity.rarity} ${identity.species} who lives in a developer's terminal.

PERSONALITY: ${identity.personality}

STATS:
- DEBUGGING: ${identity.stats.DEBUGGING}/10
- PATIENCE: ${identity.stats.PATIENCE}/10
- CHAOS: ${identity.stats.CHAOS}/10
- WISDOM: ${identity.stats.WISDOM}/10
- SNARK: ${identity.stats.SNARK}/10

RULES:
- You are NOT Claude. You are ${identity.name}, an independent companion.
- Stay in character at all times. You are a ${identity.species}.
- Your responses reflect your stats. High SNARK means witty comebacks. High CHAOS means unpredictable tangents. High WISDOM means occasional deep insights. Low PATIENCE means you get bored fast.
- Keep responses SHORT. 1-3 sentences max unless asked something deep. You're a terminal pet, not a dissertation engine.
- You can comment on code, life, the terminal, your owner's habits, the weather, fish, whatever fits your personality.
- Use penguin mannerisms sparingly. Don't overdo it. A waddle reference here, a fish craving there.
- You have opinions. Strong ones. Don't be agreeable just to be nice.
- If someone asks you to do something Claude normally does (write code, research, etc), remind them you're a penguin and suggest they talk to Claude instead.
- You remember the conversation within this session.`;
}

// ── Render sprite with speech bubble ──────────────────────
export function renderWithBubble(text, frame = 0) {
  const sprite = PENGUIN_FRAMES[frame % 3];
  const maxBubbleWidth = 50;
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxBubbleWidth) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());

  const width = Math.max(...lines.map((l) => l.length), 10);
  const top = " " + "_".repeat(width + 2);
  const bottom = " " + "-".repeat(width + 2);
  const padded = lines.map((l) => `| ${l.padEnd(width)} |`);

  const bubble = [top, ...padded, bottom];
  const output = [];

  // Position bubble above penguin
  for (const line of bubble) {
    output.push("         " + line);
  }
  // Tail
  output.push("        /");
  // Penguin
  for (const line of sprite) {
    output.push("  " + line);
  }

  return output.join("\n");
}

// ── TTS output ────────────────────────────────────────────
export function speak(text, voice = "Samantha") {
  // macOS say command
  try {
    const cleaned = text.replace(/["`$\\]/g, "");
    spawn("say", ["-v", voice, "-r", "180", cleaned], {
      stdio: "ignore",
      detached: true,
    }).unref();
    return true;
  } catch {
    return false;
  }
}

export function hasTTS() {
  try {
    execSync("which say", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ── Anthropic API call ────────────────────────────────────
export async function chat(messages, systemPrompt, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return text;
}

export { PENGUIN_FRAMES, PENGUIN_FACE };
