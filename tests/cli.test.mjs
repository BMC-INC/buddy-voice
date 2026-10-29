import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const model of [undefined, "account-selected-model"]) {
  test(`CLI sends the configured model (${model || "default"}) with a bounded request`, () => {
    const directory = mkdtempSync(join(tmpdir(), "buddy-voice-test-"));
    try {
      const capture = join(directory, "request.json");
      const preload = join(directory, "mock-api.mjs");
      writeFileSync(preload, `
        import { writeFileSync } from "node:fs";
        globalThis.fetch = async (url, options) => {
          if (url !== "https://api.anthropic.com/v1/messages") throw new Error("unexpected destination");
          if (!(options.signal instanceof AbortSignal)) throw new Error("missing request timeout");
          writeFileSync(process.env.TEST_CAPTURE, options.body);
          return { ok: true, json: async () => ({ content: [{ type: "text", text: "Hello from the test." }] }) };
        };
      `);
      const env = { ...process.env, HOME: directory, ANTHROPIC_API_KEY: "synthetic-test-key", TEST_CAPTURE: capture };
      delete env.ANTHROPIC_MODEL;
      if (model) env.ANTHROPIC_MODEL = model;
      const result = spawnSync(process.execPath, ["--import", preload, fileURLToPath(new URL("../packages/cli/bin/frostwig.mjs", import.meta.url)), "--no-voice"], { env, input: "", encoding: "utf8", timeout: 10000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Hello from the test/);
      const body = JSON.parse(readFileSync(capture, "utf8"));
      assert.equal(body.model, model || "claude-sonnet-4-6");
      assert.deepEqual(body.messages, [{ role: "user", content: "Hey! Greet me." }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
