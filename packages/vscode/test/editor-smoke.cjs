// Run only in an isolated VS Code extension host with a synthetic HOME.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');

async function runIntegration() {
  assert.equal(os.homedir(), process.env.BUDDY_TEST_HOME, 'Refusing to inspect a real user home');
  const config = vscode.workspace.getConfiguration('frostwig');
  assert.equal(config.get('enabled'), false);
  assert.equal(config.get('showNotification'), false);
  const logs = path.join(os.homedir(), '.claude');
  fs.mkdirSync(logs, { recursive: true });
  const log = path.join(logs, 'buddy.log');
  fs.writeFileSync(log, 'Existing synthetic text must be skipped.\n');
  const extension = vscode.extensions.getExtension('execlayer.frostwig-voice');
  assert.ok(extension, 'Extension must be present in the real host');
  await extension.activate();
  for (const command of ['frostwig.mute', 'frostwig.unmute', 'frostwig.testVoice']) {
    await vscode.commands.executeCommand(command);
  }
  const { TerminalMonitor } = require(path.join(extension.extensionPath, 'out/terminalMonitor.js'));
  const replies = [];
  const monitor = new TerminalMonitor('Frostwig', bubble => replies.push(bubble.text));
  try {
    assert.equal(monitor.start(), 'log-watcher', 'Stable VS Code fallback must use only the synthetic named log');
    async function waitFor(text) {
      for (let i = 0; i < 100; i++) {
        if (replies.includes(text)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.fail('Log watcher did not emit: ' + text);
    }
    fs.appendFileSync(log, 'Frostwig: Synthetic append.\n');
    await waitFor('Synthetic append.');
    fs.writeFileSync(log, 'Frostwig: Truncated.\n');
    await waitFor('Truncated.');
    fs.renameSync(log, log + '.old');
    fs.writeFileSync(log, 'Frostwig: Rotated file.\n');
    await waitFor('Rotated file.');
    assert.equal(replies.length, 3);
    assert.equal(fs.existsSync(path.join(os.homedir(), 'frostwig-debug.log')), false);
    console.log('BUDDY_EDITOR_SMOKE_PASSED: real activation, commands, append/truncate/rotation, no debug capture');
  } finally { monitor.dispose(); }
};

exports.run = async function () {
  try {
    await runIntegration();
    fs.writeFileSync(path.join(process.env.BUDDY_TEST_HOME, 'result.json'), JSON.stringify({ok:true}));
  } catch (error) {
    fs.writeFileSync(path.join(process.env.BUDDY_TEST_HOME, 'result.json'), JSON.stringify({ok:false,error:String(error.stack || error)}));
    throw error;
  }
};
