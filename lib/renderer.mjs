// lib/renderer.mjs — ASCII sprite rendering, speech bubbles, ANSI colors

// ── ANSI color helpers ───────────────────────────────────
export const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
};

// ── Render sprite with speech bubble ─────────────────────
export function renderWithBubble(text, frames, frame = 0) {
  const sprite = frames[frame % frames.length];
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

  for (const line of bubble) {
    output.push("         " + line);
  }
  output.push("        /");
  for (const line of sprite) {
    output.push("  " + line);
  }

  return output.join("\n");
}

// ── Render stat card ─────────────────────────────────────
export function renderStatCard(identity) {
  const lines = [];
  const nameHeader = `─── ${identity.name} `;
  const headerPad = Math.max(0, 30 - nameHeader.length);
  lines.push(`  ┌${nameHeader}${"─".repeat(headerPad)}┐`);
  lines.push(`  │ Species: ${identity.species.padEnd(19)}│`);
  lines.push(`  │ Rarity:  ${identity.rarity.padEnd(19)}│`);
  lines.push(`  │${"─".repeat(30)}│`);
  for (const [stat, val] of Object.entries(identity.stats)) {
    const bar = "█".repeat(val) + "░".repeat(10 - val);
    lines.push(`  │ ${stat.padEnd(10)} ${bar} ${String(val).padStart(2)} │`);
  }
  lines.push(`  └${"─".repeat(30)}┘`);
  return lines.join("\n");
}

// ── Animate sprite frames ────────────────────────────────
export async function animateSprite(frames, cycles = 6) {
  for (let i = 0; i < cycles; i++) {
    const frame = frames[i % frames.length];
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("\n\n" + frame.map((l) => "      " + l).join("\n") + "\n");
    await new Promise((r) => setTimeout(r, 500));
  }
}
