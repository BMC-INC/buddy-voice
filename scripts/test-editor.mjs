import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const executable = process.argv[2];
if (!executable) throw new Error('Pass the absolute path to the native VS Code executable');
const root = mkdtempSync(join(tmpdir(), 'buddy-editor-'));
let child;
try {
  mkdirSync(join(root, 'profile/User'), { recursive: true });
  writeFileSync(join(root, 'profile/User/settings.json'), JSON.stringify({
    'telemetry.telemetryLevel': 'off', 'update.mode': 'none',
    'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none',
    'frostwig.enabled': false, 'frostwig.showNotification': false,
  }));
  const env = { ...process.env, HOME: root, BUDDY_TEST_HOME: root };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VSCODE_IPC_HOOK_CLI;
  child = spawn(executable, [
    '--user-data-dir', join(root, 'profile'), '--extensions-dir', join(root, 'extensions'),
    '--extensionDevelopmentPath=' + resolve(process.argv[3] || 'packages/vscode'),
    '--extensionTestsPath=' + resolve(process.argv[3] || 'packages/vscode', 'test/editor-smoke.cjs'),
    '--disable-extensions', '--skip-release-notes', '--skip-welcome',
    '--disable-workspace-trust', '--skip-add-to-recently-opened', '--new-window',
  ], { env, stdio: 'ignore', detached: true });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  for (let i = 0; i < 225 && !existsSync(join(root, 'result.json')) && !spawnError; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (spawnError) throw spawnError;
  if (!existsSync(join(root, 'result.json'))) {
    // Preserve only this synthetic profile for diagnosing an editor startup failure.
    throw new Error(`Editor test did not report within 45 seconds; synthetic profile: ${root}`);
  }
  const result = JSON.parse(readFileSync(join(root, 'result.json'), 'utf8'));
  if (!result.ok) throw new Error(result.error);
  console.log('BUDDY_EDITOR_SMOKE_PASSED: real activation, commands, named log append/truncate/rotation');
} finally {
  // Close only processes carrying this unique temporary profile, including GUI
  // launchers which reparent their helper processes on macOS.
  const rows = spawnSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8' }).stdout || '';
  for (const row of rows.split('\n').reverse()) {
    const match = row.trim().match(/^(\d+)\s+(.+)$/);
    if (match && match[2].includes(root) && Number(match[1]) !== process.pid) {
      try { process.kill(Number(match[1]), 'SIGKILL'); } catch {}
    }
  }
  if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  if (existsSync(join(root, 'result.json'))) rmSync(root, { recursive: true, force: true });
}
