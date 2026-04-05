#!/usr/bin/env node

import { createInterface } from "readline";
import {
  loadBuddyConfig,
  getBuddyIdentity,
  buildSystemPrompt,
  renderWithBubble,
  speak,
  hasTTS,
  chat,
  PENGUIN_FACE,
} from "../lib/core.mjs";

// ── Color helpers (ANSI) ──────────────────────────────────
const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
};

// ── Parse args ────────────────────────────────────────────
const args = process.argv.slice(2);
const noVoice = args.includes("--no-voice") || args.includes("--silent");
const voiceFlag = args.find((a) => a.startsWith("--voice="));
const voice = voiceFlag ? voiceFlag.split("=")[1] : "Samantha";
const helpFlag = args.includes("--help") || args.includes("-h");

if (helpFlag) {
  console.log(`
${c.cyan("frostwig")} - Talk to your Claude Code buddy penguin

${c.bold("USAGE:")}
  frostwig              Start interactive chat
  frostwig --no-voice   Text only, no TTS
  frostwig --voice=Fred Use a specific macOS voice
  frostwig --help       Show this help

${c.bold("IN-SESSION COMMANDS:")}
  /voice on|off    Toggle TTS
  /voice list      List available macOS voices
  /stats           Show Frostwig's stat card
  /pet             Pet your penguin
  /sprite          Show animated sprite
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
  console.error(
    c.red("\nError: ANTHROPIC_API_KEY environment variable not set.\n")
  );
  console.error(
    c.dim("  export ANTHROPIC_API_KEY=sk-ant-...\n")
  );
  process.exit(1);
}

const companion = loadBuddyConfig();
const identity = getBuddyIdentity(companion);
const systemPrompt = buildSystemPrompt(identity);
const ttsAvailable = hasTTS();
let ttsEnabled = ttsAvailable && !noVoice;
let currentVoice = voice;
const messages = [];

// ── Startup ───────────────────────────────────────────────
console.clear();
console.log(c.cyan("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
console.log(c.bold(c.cyan(`       Talk to ${identity.name} ${PENGUIN_FACE}`)));
console.log(c.cyan("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

console.log(c.dim(`  Species: ${identity.species}  |  Rarity: ${identity.rarity}`));
console.log(c.dim(`  Voice: ${ttsEnabled ? currentVoice : "off"}  |  /help for commands\n`));

// Hatch greeting
async function greet() {
  try {
    messages.push({ role: "user", content: "Hey! I just opened a conversation with you. Greet me." });
    const response = await chat(messages, systemPrompt, apiKey);
    messages.push({ role: "assistant", content: response });
    console.log(c.cyan(renderWithBubble(response, 0)));
    console.log();
    if (ttsEnabled) speak(response, currentVoice);
  } catch (err) {
    console.log(c.cyan(renderWithBubble("*taps beak on screen* ...is this thing on?", 0)));
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
  if (!input) {
    rl.prompt();
    return;
  }

  // ── Slash commands ────────────────────────────────────
  if (input.startsWith("/")) {
    const cmd = input.toLowerCase();

    if (cmd === "/quit" || cmd === "/exit" || cmd === "/q") {
      console.log(c.cyan(`\n  ${identity.name}: *waddles away* See ya.\n`));
      if (ttsEnabled) speak("See ya.", currentVoice);
      process.exit(0);
    }

    if (cmd === "/help") {
      console.log(`
${c.bold("Commands:")}
  ${c.yellow("/voice on|off")}    Toggle TTS
  ${c.yellow("/voice list")}      List macOS voices
  ${c.yellow("/stats")}           Show stat card
  ${c.yellow("/pet")}             Pet ${identity.name}
  ${c.yellow("/sprite")}          Show sprite animation
  ${c.yellow("/clear")}           Clear conversation history
  ${c.yellow("/quit")}            Exit
`);
      rl.prompt();
      return;
    }

    if (cmd === "/stats") {
      console.log(c.cyan(`\n  ┌─── ${identity.name} ───────────────────┐`));
      console.log(c.cyan(`  │ Species: ${identity.species.padEnd(22)}│`));
      console.log(c.cyan(`  │ Rarity:  ${identity.rarity.padEnd(22)}│`));
      console.log(c.cyan(`  │${"─".repeat(33)}│`));
      for (const [stat, val] of Object.entries(identity.stats)) {
        const bar = "█".repeat(val) + "░".repeat(10 - val);
        console.log(c.cyan(`  │ ${stat.padEnd(10)} ${bar} ${String(val).padStart(2)} │`));
      }
      console.log(c.cyan(`  └${"─".repeat(33)}┘\n`));
      rl.prompt();
      return;
    }

    if (cmd === "/pet") {
      const hearts = "  ♥ ♥ ♥ ♥ ♥";
      console.log(c.magenta(`\n${hearts}`));
      console.log(c.cyan(renderWithBubble("*happy penguin noises*", 1)));
      console.log();
      if (ttsEnabled) speak("happy penguin noises", currentVoice);
      rl.prompt();
      return;
    }

    if (cmd === "/sprite") {
      const { PENGUIN_FRAMES } = await import("../lib/core.mjs");
      for (let i = 0; i < 6; i++) {
        const frame = PENGUIN_FRAMES[i % 3];
        process.stdout.write("\x1b[2J\x1b[H");
        console.log(c.cyan("\n\n" + frame.map((l) => "      " + l).join("\n") + "\n"));
        await new Promise((r) => setTimeout(r, 500));
      }
      rl.prompt();
      return;
    }

    if (cmd === "/clear") {
      messages.length = 0;
      console.log(c.dim("\n  Conversation cleared.\n"));
      rl.prompt();
      return;
    }

    if (cmd.startsWith("/voice")) {
      const sub = cmd.split(" ")[1];
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
        try {
          const { execSync } = await import("child_process");
          const voices = execSync("say -v '?'", { encoding: "utf-8" });
          console.log(c.dim("\n  Available voices:\n"));
          console.log(c.dim(voices.split("\n").slice(0, 20).map((v) => "    " + v).join("\n")));
          console.log(c.dim("\n  Use: /voice set <name>\n"));
        } catch {
          console.log(c.dim("\n  Could not list voices.\n"));
        }
      } else if (sub === "set" && cmd.split(" ")[2]) {
        currentVoice = cmd.split(" ").slice(2).join(" ");
        console.log(c.dim(`\n  Voice set to: ${currentVoice}\n`));
        if (ttsEnabled) speak("Testing, testing.", currentVoice);
      } else {
        console.log(c.dim(`\n  Voice: ${ttsEnabled ? "on (" + currentVoice + ")" : "off"}\n`));
      }
      rl.prompt();
      return;
    }

    console.log(c.dim(`\n  Unknown command: ${input}. Try /help\n`));
    rl.prompt();
    return;
  }

  // ── Chat with Frostwig ────────────────────────────────
  process.stdout.write(c.dim(`  ${identity.name} is thinking...`));

  messages.push({ role: "user", content: input });

  try {
    const response = await chat(messages, systemPrompt, apiKey);
    messages.push({ role: "assistant", content: response });

    // Clear "thinking" line
    process.stdout.write("\r\x1b[K");

    const frame = Math.floor(Math.random() * 3);
    console.log(c.cyan(renderWithBubble(response, frame)));
    console.log();

    if (ttsEnabled) speak(response, currentVoice);
  } catch (err) {
    process.stdout.write("\r\x1b[K");
    console.log(c.red(`  Error: ${err.message}\n`));
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log(c.cyan(`\n  ${identity.name}: *slides off screen* Bye!\n`));
  process.exit(0);
});
