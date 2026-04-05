// shared/tts.mjs — macOS say wrapper with speech queue
import { execSync, spawn } from "child_process";

let queue = [];
let speaking = false;
let currentVoice = "Samantha";
let enabled = true;

function processQueue() {
  if (speaking || queue.length === 0) return;
  speaking = true;
  const text = queue.shift();
  const cleaned = text.replace(/["`$\\]/g, "");

  try {
    const proc = spawn("say", ["-v", currentVoice, "-r", "180", cleaned], {
      stdio: "ignore",
    });
    proc.on("close", () => {
      speaking = false;
      processQueue();
    });
    proc.on("error", () => {
      speaking = false;
      processQueue();
    });
  } catch {
    speaking = false;
    processQueue();
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
}

export function isEnabled() {
  return enabled;
}

export function clearQueue() {
  queue = [];
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
