// shared/parser.mjs — extracts plain text from buddy speech patterns

function stripAnsi(text) {
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "");
}

const FACE_PATTERNS = [
  /\(o>\s*"(.+?)"/,
  /=\^\.?\^=\s*"(.+?)"/,
  /\{o,o\}\s*"(.+?)"/,
  />\(\)\s*"(.+?)"/,
  /~\(o\)~\s*"(.+?)"/,
  /\[o_o\]\s*"(.+?)"/,
];

const BUBBLE_TOP = /^\s*_{3,}\s*$/;
const BUBBLE_LINE = /^\s*\|\s*(.+?)\s*\|\s*$/;
const BUBBLE_BOTTOM = /^\s*-{3,}\s*$/;

export function parseBuddySpeech(data, buddyName = "Frostwig") {
  const clean = stripAnsi(data);
  const results = [];
  const lines = clean.split("\n");
  let inBubble = false;
  let bubbleBuffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: Face + quoted speech
    for (const pattern of FACE_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        results.push(match[1]);
        break;
      }
    }

    // Pattern 2: ASCII bubble block
    if (BUBBLE_TOP.test(trimmed)) {
      inBubble = true;
      bubbleBuffer = [];
      continue;
    }

    if (inBubble) {
      const lineMatch = trimmed.match(BUBBLE_LINE);
      if (lineMatch) {
        bubbleBuffer.push(lineMatch[1].trim());
        continue;
      }

      if (BUBBLE_BOTTOM.test(trimmed)) {
        inBubble = false;
        if (bubbleBuffer.length > 0) {
          results.push(bubbleBuffer.join(" "));
        }
        bubbleBuffer = [];
        continue;
      }
    }

    // Pattern 3: Name-prefixed speech
    const escaped = buddyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const namePattern = new RegExp(`^${escaped}:\\s+(.+)$`, "i");
    const nameMatch = trimmed.match(namePattern);
    if (nameMatch && !nameMatch[1].startsWith("/") && !/^\d/.test(nameMatch[1])) {
      results.push(nameMatch[1]);
    }
  }

  return results;
}
