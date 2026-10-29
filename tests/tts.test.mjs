import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const require = createRequire(import.meta.url);

function engine() {
  const children = [];
  const fakeSpawn = (command, args) => {
    const child = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.end = text => { child.text = text; };
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit("close", null)); };
    child.args = args;
    children.push(child);
    return child;
  };
  const exports = {};
  runInNewContext(readFileSync(new URL("../packages/vscode/out/tts.js", import.meta.url), "utf8"), {
    exports,
    require: name => name === "child_process" ? { spawn: fakeSpawn } : name === "vscode" ? {
      workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
    } : require(name),
  });
  return { tts: new exports.TTSEngine(), children };
}

test("mute stops current speech and discards pending speech", async () => {
  const { tts, children } = engine();
  tts.speak("first"); tts.speak("second");
  assert.equal(children.length, 1);
  tts.setMuted(true);
  assert.equal(children[0].killed, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(children.length, 1);
  tts.setMuted(false);
  tts.speak("third");
  assert.equal(children.length, 2);
  assert.equal(children[1].text, "third");
});

test("speech is passed on stdin and duplicate process events cannot overlap the queue", () => {
  const { tts, children } = engine();
  tts.speak("-o private-file"); tts.speak("second"); tts.speak("third");
  assert.equal(children[0].text, "-o private-file");
  assert.equal(children[0].args.includes("-o private-file"), false);
  children[0].emit("error", new Error("say failed"));
  assert.equal(children.length, 2);
  children[0].emit("close", 1);
  assert.equal(children.length, 2);
  children[1].emit("close", 0);
  assert.equal(children.length, 3);
});
