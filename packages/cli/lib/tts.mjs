// cli/lib/tts.mjs — macOS say wrapper with speech queue
import { execSync, spawn } from "child_process";

let queue = [];
let speaking = false;
let currentProcess = null;
let currentVoice = "Samantha";
let enabled = true;

function processQueue() {
  if (!enabled || speaking || queue.length === 0) return;
  speaking = true;
  const text = queue.shift();
  // Strip chars that macOS say vocalizes literally, and collapse
  // repeated punctuation (e.g. "..." or "!!") to a single instance
  const cleaned = text
    .replace(/["`$\\*_~#<>{}[\]()]/g, "")
    .replace(/([.,!?;:]){2,}/g, "$1")
    .replace(/\s[.,!?;:]\s/g, " ")
    .trim();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    currentProcess = null;
    speaking = false;
    processQueue();
  };
  try {
    const proc = spawn("say", ["-v", currentVoice, "-r", "180"], {
      stdio: ["pipe", "ignore", "ignore"],
    });
    currentProcess = proc;
    proc.once("close", finish);
    proc.once("error", finish);
    proc.stdin.on("error", () => {});
    proc.stdin.end(cleaned);
  } catch {
    finish();
  }
}

export function speak(text) {
  if (!enabled || !text.trim()) return;
  queue.push(text);
  processQueue();
}

export function setVoice(voice) {
  currentVoice = voice;
}

export function getVoice() {
  return currentVoice;
}

export function setEnabled(val) {
  enabled = val;
  if (!enabled) clearQueue();
}

export function isEnabled() {
  return enabled;
}

export function clearQueue() {
  queue = [];
  currentProcess?.kill();
}

export function hasTTS() {
  try {
    execSync("which say", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function listVoices() {
  if (!hasTTS()) return [];
  try {
    const output = execSync("say -v '?'", { encoding: "utf-8" });
    return output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}
