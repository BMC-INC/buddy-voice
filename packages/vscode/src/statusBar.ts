import * as vscode from 'vscode';
import { TTSEngine } from './tts';

export class FrostwigStatusBar {
    private item: vscode.StatusBarItem;
    private tts: TTSEngine;
    private buddyName: string;

    constructor(tts: TTSEngine, buddyName: string) {
        this.tts = tts;
        this.buddyName = buddyName;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'frostwig.toggleVoice';
        this.update();
        this.item.show();
    }

    update(): void {
        const enabled = this.tts.isEnabled();
        const muted = this.tts.isMuted();
        const voice = this.tts.getVoice();

        if (!enabled) {
            this.item.text = '$(mute) Frostwig';
            this.item.tooltip = `${this.buddyName} - Voice disabled\nClick to enable`;
            this.item.color = undefined;
        } else if (muted) {
            this.item.text = '$(mute) Frostwig';
            this.item.tooltip = `${this.buddyName} - Muted\nVoice: ${voice}\nClick to toggle`;
            this.item.color = undefined;
        } else {
            this.item.text = '$(unmute) Frostwig';
            this.item.tooltip = `${this.buddyName} - Listening\nVoice: ${voice}\nClick to toggle`;
            this.item.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        }
    }

    setBuddyName(name: string): void {
        this.buddyName = name;
        this.update();
    }

    dispose(): void {
        this.item.dispose();
    }
}
