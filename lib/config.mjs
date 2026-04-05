// lib/config.mjs — Read ~/.claude.json companion field, extract identity
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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
    personality: companion.personality || `A mysterious ${companion.species || "penguin"} of few words.`,
    stats: companion.stats || { DEBUGGING: 5, PATIENCE: 5, CHAOS: 5, WISDOM: 5, SNARK: 5 },
  };
}
