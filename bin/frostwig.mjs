#!/usr/bin/env node

import { createInterface } from "readline";
import { loadBuddyConfig, getBuddyIdentity } from "../lib/config.mjs";
import { buildSystemPrompt, chat } from "../lib/conversation.mjs";
import { c, renderWithBubble, renderStatCard, animateSprite } from "../lib/renderer.mjs";
import { speak, hasTTS, listVoices } from "../lib/tts.mjs";
import { getSpecies } from "../lib/species.mjs";

// ── Parse args ────────────────────────────────────────────
const args = process.argv.slice(2);
const noVoice = args.includes("--no-voice") || args.includes("--silent");
const voiceFlag = args.find((a) => a.startsWith("--voice="));
const helpFlag = args.includes("--help") || args.includes("-h");

if (helpFlag) {
  console.log(`
${c.cyan("frostwig")} - Talk to your Claude Code buddy

${c.bold("USAGE:")}
  frostwig              Start interactive chat
  frostwig --no-voice   Text only, no TTS
  frostwig --voice=Fred Use a specific macOS voice
  frostwig --help       Show this help

${c.bold("IN-SESSION COMMANDS:")}
  /voice on|off    Toggle TTS
  /voice list      List available macOS voices
  /voice set <n>   Change voice
  /stats           Show stat card
  /pet             Pet your buddy
  /sprite          Animated ASCII sprite
  /mood            Current mood
  /clear           Reset conversation
  /quit            Exit

${c.bold("REQUIREMENTS:")}
  - ANTHROPIC_API_KEY env var (for conversation)
  - macOS 'say' command (for voice, optional)
  - Claude Code buddy config in ~/.claude.json (optional, has defaults)
`);
  process.exit(0);
}

// ── Init ──────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(c.red("\nError: ANTHROPIC_API_KEY environment variable not set.\n"));
  console.error(c.dim("  export ANTHROPIC_API_KEY=sk-ant-...\n"));
  process.exit(1);
}

const companion = loadBuddyConfig();
const identity = getBuddyIdentity(companion);
const speciesData = getSpecies(identity.species);
const systemPrompt = buildSystemPrompt(identity);
const ttsAvailable = hasTTS();

// Voice: use flag override, or species default
const defaultVoice = voiceFlag ? voiceFlag.split("=")[1] : speciesData.voice;
let ttsEnabled = ttsAvailable && !noVoice;
let currentVoice = defaultVoice;
const messages = [];

// Mood tracking
let moodScore = 5; // 1-10 scale, starts neutral

function updateMood(text) {
  const lower = text.toLowerCase();
  const positive = ["love", "great", "awesome", "good", "nice", "thanks", "cool", "wow", "haha", "lol", "yes", "pet", "happy"];
  const negative = ["hate", "bad", "stupid", "ugly", "boring", "shut", "no", "wrong", "dumb", "ugh"];
  for (const w of positive) { if (lower.includes(w)) { moodScore = Math.min(10, moodScore + 1); return; } }
  for (const w of negative) { if (lower.includes(w)) { moodScore = Math.max(1, moodScore - 1); return; } }
}

function getMoodLabel() {
  if (moodScore >= 9) return "ecstatic";
  if (moodScore >= 7) return "happy";
  if (moodScore >= 5) return "neutral";
  if (moodScore >= 3) return "grumpy";
  return "furious";
}

function getMoodBar() {
  return "█".repeat(moodScore) + "░".repeat(10 - moodScore);
}

// ── Startup ───────────────────────────────────────────────
if (!companion) {
  console.log(c.yellow("\n  No buddy config found in ~/.claude.json"));
  console.log(c.dim("  Run /buddy in Claude Code to get a companion first."));
  console.log(c.dim("  Using default Frostwig the penguin for now.\n"));
}

console.clear();
console.log(c.cyan("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
console.log(c.bold(c.cyan(`       Talk to ${identity.name} ${speciesData.face}`)));
console.log(c.cyan("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

console.log(c.dim(`  Species: ${identity.species}  |  Rarity: ${identity.rarity}`));
console.log(c.dim(`  Voice: ${ttsEnabled ? currentVoice : "off"}  |  /help for commands\n`));

// ── Greeting ──────────────────────────────────────────────
async function greet() {
  try {
    messages.push({ role: "user", content: "Hey! I just opened a conversation with you. Greet me." });
    const response = await chat(messages, systemPrompt, apiKey);
    messages.push({ role: "assistant", content: response });
    console.log(c.cyan(renderWithBubble(response, speciesData.frames, 0)));
    console.log();
    if (ttsEnabled) speak(response, currentVoice);
  } catch (err) {
    console.log(c.cyan(renderWithBubble("*taps on screen* ...is this thing on?", speciesData.frames, 0)));
    console.log(c.dim(`  (API error: ${err.message})`));
    console.log();
  }
}

await greet();

// ── REPL ──────────────────────────────────────────────────
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: c.green(`  you > `),
});

rl.prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) { rl.prompt(); return; }

  // ── Slash commands ────────────────────────────────────
  if (input.startsWith("/")) {
    const cmd = input.toLowerCase();

    if (cmd === "/quit" || cmd === "/exit" || cmd === "/q") {
      console.log(c.cyan(`\n  ${identity.name}: See ya.\n`));
      if (ttsEnabled) speak("See ya.", currentVoice);
      process.exit(0);
    }

    if (cmd === "/help") {
      console.log(`
${c.bold("Commands:")}
  ${c.yellow("/voice on|off")}    Toggle TTS
  ${c.yellow("/voice list")}      List macOS voices
  ${c.yellow("/voice set <n>")}   Change voice
  ${c.yellow("/stats")}           Show stat card
  ${c.yellow("/pet")}             Pet ${identity.name}
  ${c.yellow("/sprite")}          Show sprite animation
  ${c.yellow("/mood")}            Current mood
  ${c.yellow("/clear")}           Clear conversation history
  ${c.yellow("/quit")}            Exit
`);
      rl.prompt(); return;
    }

    if (cmd === "/stats") {
      console.log(c.cyan("\n" + renderStatCard(identity) + "\n"));
      rl.prompt(); return;
    }

    if (cmd === "/pet") {
      const hearts = "  ♥ ♥ ♥ ♥ ♥";
      moodScore = Math.min(10, moodScore + 2);
      console.log(c.magenta(`\n${hearts}`));
      console.log(c.cyan(renderWithBubble(`*happy ${identity.species} noises*`, speciesData.frames, 1)));
      console.log();
      if (ttsEnabled) speak(`happy ${identity.species} noises`, currentVoice);
      rl.prompt(); return;
    }

    if (cmd === "/sprite") {
      await animateSprite(speciesData.frames);
      rl.prompt(); return;
    }

    if (cmd === "/mood") {
      const label = getMoodLabel();
      const bar = getMoodBar();
      console.log(c.cyan(`\n  ${identity.name}'s mood: ${label}`));
      console.log(c.cyan(`  ${bar} ${moodScore}/10\n`));
      rl.prompt(); return;
    }

    if (cmd === "/clear") {
      messages.length = 0;
      moodScore = 5;
      console.log(c.dim("\n  Conversation cleared.\n"));
      rl.prompt(); return;
    }

    if (cmd.startsWith("/voice")) {
      const parts = cmd.split(" ");
      const sub = parts[1];
      if (sub === "off") {
        ttsEnabled = false;
        console.log(c.dim("\n  Voice disabled.\n"));
      } else if (sub === "on") {
        if (ttsAvailable) {
          ttsEnabled = true;
          console.log(c.dim(`\n  Voice enabled (${currentVoice}).\n`));
        } else {
          console.log(c.dim("\n  macOS 'say' command not found. Voice unavailable.\n"));
        }
      } else if (sub === "list") {
        const voices = listVoices();
        if (voices.length > 0) {
          console.log(c.dim("\n  Available voices:\n"));
          console.log(c.dim(voices.slice(0, 25).map((v) => "    " + v).join("\n")));
          if (voices.length > 25) console.log(c.dim(`    ... and ${voices.length - 25} more`));
          console.log(c.dim("\n  Use: /voice set <name>\n"));
        } else {
          console.log(c.dim("\n  Could not list voices.\n"));
        }
      } else if (sub === "set" && parts[2]) {
        currentVoice = parts.slice(2).join(" ");
        console.log(c.dim(`\n  Voice set to: ${currentVoice}\n`));
        if (ttsEnabled) speak("Testing, testing.", currentVoice);
      } else {
        console.log(c.dim(`\n  Voice: ${ttsEnabled ? "on (" + currentVoice + ")" : "off"}\n`));
      }
      rl.prompt(); return;
    }

    console.log(c.dim(`\n  Unknown command: ${input}. Try /help\n`));
    rl.prompt(); return;
  }

  // ── Chat ──────────────────────────────────────────────
  updateMood(input);
  process.stdout.write(c.dim(`  ${identity.name} is thinking...`));

  messages.push({ role: "user", content: input });

  try {
    const response = await chat(messages, systemPrompt, apiKey);
    messages.push({ role: "assistant", content: response });

    process.stdout.write("\r\x1b[K");

    const frame = Math.floor(Math.random() * speciesData.frames.length);
    console.log(c.cyan(renderWithBubble(response, speciesData.frames, frame)));
    console.log();

    if (ttsEnabled) speak(response, currentVoice);
  } catch (err) {
    process.stdout.write("\r\x1b[K");
    console.log(c.red(`  Error: ${err.message}\n`));
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log(c.cyan(`\n  ${identity.name}: Bye!\n`));
  process.exit(0);
});
