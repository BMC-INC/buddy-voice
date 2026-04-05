// lib/tts.mjs — macOS say wrapper, voice listing, voice selection
import { execSync, spawn } from "child_process";

export function speak(text, voice = "Samantha") {
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

export function listVoices() {
  if (!hasTTS()) {
    return [];
  }

  try {
    const output = execSync("say -v '?'", { encoding: "utf-8" });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}
