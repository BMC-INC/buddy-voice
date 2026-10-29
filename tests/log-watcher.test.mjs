import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(new URL('../packages/vscode/out/terminalMonitor.js', import.meta.url));

test('named companion logs keep working after truncation and rotation', async () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'buddy-log-fixture-'));
  const folder = join(root, '.claude');
  fs.mkdirSync(folder);
  const log = join(folder, 'buddy.log');
  fs.writeFileSync(log, 'Frostwig: Existing history must be skipped.\n');
  const exports = {};
  const replies = [];
  runInNewContext(fs.readFileSync(new URL('../packages/vscode/out/terminalMonitor.js', import.meta.url), 'utf8'), {
    exports, Buffer, setTimeout, clearTimeout,
    require: name => name === 'vscode' ? { window: {} } : name === 'os' ? { homedir: () => root } : require(name),
  });
  const monitor = new exports.TerminalMonitor('Frostwig', bubble => replies.push(bubble.text));
  async function waitFor(text) {
    for (let i = 0; i < 100; i++) {
      if (replies.includes(text)) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail('Missing synthetic log reply: ' + text);
  }
  try {
    assert.equal(monitor.start(), 'log-watcher');
    assert.deepEqual(replies, []);
    fs.appendFileSync(log, 'Frostwig: First appended reply.\n');
    await waitFor('First appended reply.');
    fs.writeFileSync(log, 'Frostwig: Truncated.\n');
    await waitFor('Truncated.');
    fs.renameSync(log, log + '.old');
    fs.writeFileSync(log, 'Frostwig: Rotated.\n');
    await waitFor('Rotated.');
    assert.deepEqual(replies, ['First appended reply.', 'Truncated.', 'Rotated.']);
  } finally {
    monitor.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
