import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const require = createRequire(new URL("../packages/vscode/out/terminalMonitor.js", import.meta.url));

function monitor() {
  const writes = [];
  const output = [];
  const exports = {};
  runInNewContext(readFileSync(new URL("../packages/vscode/out/terminalMonitor.js", import.meta.url), "utf8"), {
    exports, setTimeout, clearTimeout,
    require: name => name === "vscode" ? { window: {} } : name === "fs" ? {
      existsSync: () => false,
      appendFileSync: (...args) => writes.push(args),
    } : require(name),
  });
  return { instance: new exports.TerminalMonitor("Frostwig", text => output.push(text)), writes, output };
}

test("unsupported editor reports no monitoring input", () => {
  const { instance } = monitor();
  assert.equal(instance.start(), "none");
  instance.dispose();
});

test("detected terminal text is emitted without being written to a debug file", () => {
  const { instance, output, writes } = monitor();
  instance.scanRawData("┌──────────────────────┐\n│ A private companion reply │\n└──────────────────────┘");
  assert.equal(output.length, 1);
  assert.equal(output[0].text, "A private companion reply");
  assert.equal(writes.length, 0);
});
