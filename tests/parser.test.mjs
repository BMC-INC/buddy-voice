import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { BubbleParser } = require("../packages/vscode/out/bubbleParser.js");

test("unicode bubbles spanning terminal chunks are emitted once complete", () => {
  const parser = new BubbleParser("Frostwig");
  assert.deepEqual(parser.parse("┌──────────┐\n│ Hello │\n"), []);
  assert.deepEqual(parser.parse("│ world │\n└──────────┘"), [{ text: "Hello world", pattern: "bubble" }]);
});

test("name matching escapes punctuation and ignores ordinary terminal content", () => {
  const parser = new BubbleParser("Buddy[1]");
  assert.deepEqual(parser.parse("Buddy1: not mine\nconsole output\nBuddy[1]: /tmp/private"), []);
  assert.deepEqual(parser.parse("\x1b[32mBuddy[1]: Hi there\x1b[0m"), [{ text: "Hi there", pattern: "named" }]);
});
