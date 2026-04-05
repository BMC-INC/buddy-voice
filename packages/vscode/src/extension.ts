import * as vscode from 'vscode';
import { TTSEngine } from './tts';
import { TerminalMonitor } from './terminalMonitor';
import { FrostwigStatusBar } from './statusBar';
import { loadBuddyConfig, getBuddyName, shouldShowNotification } from './config';
import { ParsedBubble } from './bubbleParser';

let tts: TTSEngine;
let monitor: TerminalMonitor;
let statusBar: FrostwigStatusBar;

export function activate(context: vscode.ExtensionContext) {
    const buddyName = getBuddyName();

    tts = new TTSEngine();
    statusBar = new FrostwigStatusBar(tts, buddyName);
    context.subscriptions.push({ dispose: () => statusBar.dispose() });

    monitor = new TerminalMonitor(buddyName, (bubble: ParsedBubble) => {
        tts.speak(bubble.text);
        if (shouldShowNotification()) {
            vscode.window.showInformationMessage(`${buddyName}: ${bubble.text}`);
        }
    });

    const mode = monitor.start();
    vscode.window.setStatusBarMessage(`Frostwig: monitoring via ${mode}`, 3000);
    context.subscriptions.push({ dispose: () => monitor.dispose() });

    context.subscriptions.push(
        vscode.commands.registerCommand('frostwig.toggleVoice', () => {
            const enabled = tts.toggleVoice();
            statusBar.update();
            vscode.window.showInformationMessage(`Frostwig voice ${enabled ? 'enabled' : 'disabled'}`);
        }),
        vscode.commands.registerCommand('frostwig.changeVoice', async () => {
            const voices = TTSEngine.listVoices();
            if (!voices.length) { vscode.window.showWarningMessage('No voices found'); return; }
            const picked = await vscode.window.showQuickPick(voices, { placeHolder: `Current: ${tts.getVoice()}` });
            if (picked) { tts.setVoice(picked); statusBar.update(); tts.speak('Voice changed.'); }
        }),
        vscode.commands.registerCommand('frostwig.testVoice', () => {
            tts.speak(`Hi, I'm ${buddyName}. Can you hear me?`);
        }),
        vscode.commands.registerCommand('frostwig.showStats', () => {
            const buddy = loadBuddyConfig();
            if (!buddy) { vscode.window.showInformationMessage('No buddy config. Run /buddy in Claude Code.'); return; }
            const stats = Object.entries(buddy.stats || {}).map(([k, v]) => `${k}: ${v}/10`).join('\n');
            vscode.window.showInformationMessage(`${buddy.name} the ${buddy.species}\n\n${stats}`, { modal: true });
        }),
        vscode.commands.registerCommand('frostwig.mute', () => {
            tts.setMuted(true); tts.clearQueue(); statusBar.update();
        }),
        vscode.commands.registerCommand('frostwig.unmute', () => {
            tts.setMuted(false); statusBar.update();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('frostwig')) { tts.loadSettings(); statusBar.update(); }
        })
    );
}

export function deactivate() {
    if (monitor) monitor.dispose();
    if (statusBar) statusBar.dispose();
    if (tts) tts.clearQueue();
}
