#!/usr/bin/env node

import { createInterface } from "readline";
import { loadBuddyConfig, getBuddyIdentity } from "../../shared/config.mjs";
import { speak, setVoice, getVoice, setEnabled, isEnabled, hasTTS, listVoices } from "../../shared/tts.mjs";

const args = process.argv.slice(2);
const noVoice = args.includes("--no-voice") || args.includes("--silent");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
buddy-voice - talk to your Claude Code buddy with voice

USAGE:
  buddy-voice              Start interactive chat
  buddy-voice --no-voice   Text only
  buddy-voice --help       Show this help

IN-SESSION:
  /voice on|off    Toggle TTS
  /voice set <n>   Change voice
  /voice list      List voices
  /stats           Show buddy stats
  /pet             Pet your buddy
  /mute            Mute voice
  /quit            Exit

REQUIRES:
  ANTHROPIC_API_KEY env var
  macOS say command (optional, for voice)
`);
  process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("\nError: ANTHROPIC_API_KEY not set.\n  export ANTHROPIC_API_KEY=sk-ant-...\n");
  process.exit(1);
}

const companion = loadBuddyConfig();
const identity = getBuddyIdentity(companion);
const ttsAvailable = hasTTS();

if (!ttsAvailable) {
  console.log("  Note: macOS say not found. Voice disabled.\n");
}

if (!companion) {
  console.log("  No buddy config in ~/.claude.json. Using default Frostwig.\n");
}

let voiceOn = ttsAvailable && !noVoice;
setEnabled(voiceOn);

const messages = [];

function buildSystemPrompt() {
  return `You are ${identity.name}, a ${identity.rarity} ${identity.species} who lives in a developer's terminal.

PERSONALITY: ${identity.personality}

STATS:
- DEBUGGING: ${identity.stats.DEBUGGING}/10
- PATIENCE: ${identity.stats.PATIENCE}/10
- CHAOS: ${identity.stats.CHAOS}/10
- WISDOM: ${identity.stats.WISDOM}/10
- SNARK: ${identity.stats.SNARK}/10

RULES:
- You are NOT Claude. You are ${identity.name}.
- Keep responses to 1-3 sentences.
- Your personality reflects your stats.
- You have strong opinions.
- Use ${identity.species} mannerisms sparingly.
- If asked to do Claude's job, redirect to Claude.`;
}

const systemPrompt = buildSystemPrompt();

async function chat(msgs) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: systemPrompt,
      messages: msgs,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

console.log(`\n  ${identity.name} the ${identity.species} | voice: ${voiceOn ? getVoice() : "off"} | /help\n`);

// Greeting
try {
  messages.push({ role: "user", content: "Hey! Greet me." });
  const greeting = await chat(messages);
  messages.push({ role: "assistant", content: greeting });
  console.log(`  ${identity.name}: ${greeting}\n`);
  if (voiceOn) speak(greeting);
} catch (err) {
  console.log(`  ${identity.name}: *taps on screen* ...is this thing on?\n  (${err.message})\n`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "  you > " });
rl.prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) { rl.prompt(); return; }

  if (input.startsWith("/")) {
    const cmd = input.toLowerCase();

    if (cmd === "/quit" || cmd === "/q") {
      console.log(`\n  ${identity.name}: See ya.\n`);
      if (voiceOn) speak("See ya.");
      setTimeout(() => process.exit(0), 500);
      return;
    }

    if (cmd === "/help") {
      console.log(`\n  /voice on|off  /voice set <n>  /voice list\n  /stats  /pet  /mute  /quit\n`);
      rl.prompt(); return;
    }

    if (cmd === "/stats") {
      console.log(`\n  ${identity.name} the ${identity.species} (${identity.rarity})`);
      for (const [k, v] of Object.entries(identity.stats)) {
        console.log(`  ${k}: ${v}/10`);
      }
      console.log();
      rl.prompt(); return;
    }

    if (cmd === "/pet") {
      const msg = `*happy ${identity.species} noises*`;
      console.log(`\n  ${identity.name}: ${msg}\n`);
      if (voiceOn) speak(msg);
      rl.prompt(); return;
    }

    if (cmd === "/mute") {
      voiceOn = false;
      setEnabled(false);
      console.log("\n  Voice muted.\n");
      rl.prompt(); return;
    }

    if (cmd.startsWith("/voice")) {
      const parts = cmd.split(" ");
      const sub = parts[1];
      if (sub === "off") { voiceOn = false; setEnabled(false); console.log("\n  Voice off.\n"); }
      else if (sub === "on") {
        if (ttsAvailable) { voiceOn = true; setEnabled(true); console.log(`\n  Voice on (${getVoice()}).\n`); }
        else console.log("\n  macOS say not found.\n");
      }
      else if (sub === "list") {
        const voices = listVoices();
        if (voices.length) console.log(`\n  ${voices.slice(0, 20).join(", ")}\n`);
        else console.log("\n  No voices found.\n");
      }
      else if (sub === "set" && parts[2]) {
        setVoice(parts.slice(2).join(" "));
        console.log(`\n  Voice: ${getVoice()}\n`);
        if (voiceOn) speak("Testing.");
      }
      else console.log(`\n  Voice: ${voiceOn ? getVoice() : "off"}\n`);
      rl.prompt(); return;
    }

    console.log(`\n  Unknown: ${input}. Try /help\n`);
    rl.prompt(); return;
  }

  process.stdout.write(`  ${identity.name} is thinking...`);
  messages.push({ role: "user", content: input });

  try {
    const response = await chat(messages);
    messages.push({ role: "assistant", content: response });
    process.stdout.write("\r\x1b[K");
    console.log(`  ${identity.name}: ${response}\n`);
    if (voiceOn) speak(response);
  } catch (err) {
    process.stdout.write("\r\x1b[K");
    console.log(`  Error: ${err.message}\n`);
  }

  rl.prompt();
});

rl.on("close", () => { console.log(`\n  ${identity.name}: Bye!\n`); process.exit(0); });
