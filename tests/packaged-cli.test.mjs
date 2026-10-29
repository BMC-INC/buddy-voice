import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("the published CLI tarball installs and runs independently of the workspace", () => {
  const root = mkdtempSync(join(tmpdir(), "buddy-release-"));
  try {
    function run(command, args, options = {}) {
      const result = spawnSync(command, args, { encoding: "utf8", timeout: 60000, ...options });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return result.stdout;
    }
    run("npm", ["pack", "--workspace", "buddy-voice-cli", "--pack-destination", root], { cwd: resolve(".") });
    const archive = join(root, readdirSync(root).find(name => name.endsWith(".tgz")));
    run("npm", ["install", "--prefix", join(root, "installed"), "--ignore-scripts", "--no-audit", "--no-fund", archive], { cwd: root });
    const cli = join(root, "installed/node_modules/.bin/buddy-voice");
    assert.match(run(process.execPath, [cli, "--help"], { cwd: root }), /ANTHROPIC_API_KEY/);
    const fixture = join(root, "mock-api.mjs");
    writeFileSync(fixture, `import os from "node:os"; import {syncBuiltinESMExports} from "node:module"; os.homedir=()=>process.env.BUDDY_TEST_ROOT; syncBuiltinESMExports(); globalThis.fetch = async () => ({ok:true,json:async()=>({content:[{type:"text",text:"Packaged greeting."}]})});`);
    const output = run(process.execPath, ["--import", fixture, cli, "--no-voice"], {
      cwd: root, env: { ...process.env, BUDDY_TEST_ROOT: root, ANTHROPIC_API_KEY: "synthetic-fixture" }, input: "/stats\n/quit\n",
    });
    assert.match(output, /Packaged greeting/);
    assert.match(output, /DEBUGGING/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
