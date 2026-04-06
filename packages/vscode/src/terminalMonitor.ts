import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BubbleParser, ParsedBubble } from './bubbleParser';
import { VTermScreen } from './vtScreen';

export type BubbleCallback = (bubble: ParsedBubble) => void;

export class TerminalMonitor {
    private parser: BubbleParser;
    private callback: BubbleCallback;
    private disposables: vscode.Disposable[] = [];
    private mode: 'terminal-data' | 'log-watcher' | 'none' = 'none';
    private logWatcher: fs.FSWatcher | null = null;
    private lastLogSize: number = 0;
    private logPath: string = '';
    private screen: VTermScreen;
    private parseTimer: ReturnType<typeof setTimeout> | null = null;
    private spokenTexts: Set<string> = new Set();
    private ready: boolean = false;

    constructor(buddyName: string, callback: BubbleCallback) {
        this.parser = new BubbleParser(buddyName);
        this.callback = callback;
        this.screen = new VTermScreen();
    }

    start(): string {
        if (this.tryTerminalDataAPI()) {
            this.mode = 'terminal-data';
            return this.mode;
        }
        if (this.tryLogWatcher()) {
            this.mode = 'log-watcher';
            return this.mode;
        }
        this.mode = 'none';
        return this.mode;
    }

    private tryTerminalDataAPI(): boolean {
        try {
            const onDidWrite = (vscode.window as any).onDidWriteTerminalData;
            if (typeof onDidWrite !== 'function') return false;

            // Grace period: ignore the initial terminal buffer dump
            setTimeout(() => {
                this.screen.reset();
                this.parser.reset();
                this.ready = true;
            }, 1500);

            const disposable = onDidWrite((e: { terminal: vscode.Terminal; data: string }) => {
                this.screen.feed(e.data);
                if (!this.ready) return;

                // Debounce: wait for the TUI render frame to finish
                if (this.parseTimer) clearTimeout(this.parseTimer);
                this.parseTimer = setTimeout(() => this.scanScreen(), 150);
            });

            this.disposables.push(disposable);
            return true;
        } catch {
            return false;
        }
    }

    private debugFile(msg: string): void {
        const p = require('path').join(require('os').homedir(), 'frostwig-debug.log');
        require('fs').appendFileSync(p, `${new Date().toISOString()} ${msg}\n`);
    }

    private scanScreen(): void {
        this.parser.reset();
        const screenText = this.screen.getScreen();
        if (!screenText.trim()) return;

        // Dump screen lines that contain box-drawing chars for debugging
        const interesting = screenText.split('\n').filter(l => /[┌┐└┘│╭╮╰╯║]/.test(l));
        if (interesting.length > 0) {
            this.debugFile(`BOX LINES (${interesting.length}): ${interesting.slice(0, 10).map(l => l.substring(0, 120)).join(' | ')}`);
        }

        const bubbles = this.parser.parse(screenText);
        for (const bubble of bubbles) {
            const key = bubble.text.trim();
            if (!key || this.spokenTexts.has(key)) continue;
            this.spokenTexts.add(key);
            if (this.spokenTexts.size > 200) {
                const first = this.spokenTexts.values().next().value;
                if (first !== undefined) this.spokenTexts.delete(first);
            }
            this.callback(bubble);
        }
    }

    private tryLogWatcher(): boolean {
        const claudeDir = path.join(os.homedir(), '.claude');
        if (!fs.existsSync(claudeDir)) return false;

        const logCandidates = [
            path.join(claudeDir, 'buddy.log'),
            path.join(claudeDir, 'companion.log'),
        ];

        const logsDir = path.join(claudeDir, 'logs');
        if (fs.existsSync(logsDir)) {
            try {
                const files = fs.readdirSync(logsDir)
                    .filter(f => f.endsWith('.log'))
                    .map(f => ({
                        name: f,
                        mtime: fs.statSync(path.join(logsDir, f)).mtime.getTime()
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                if (files.length > 0) {
                    logCandidates.push(path.join(logsDir, files[0].name));
                }
            } catch { /* ignore */ }
        }

        for (const candidate of logCandidates) {
            if (fs.existsSync(candidate)) {
                this.logPath = candidate;
                try {
                    const stat = fs.statSync(candidate);
                    this.lastLogSize = stat.size;
                    this.logWatcher = fs.watch(candidate, (eventType) => {
                        if (eventType === 'change') this.readNewLogContent();
                    });
                    return true;
                } catch { continue; }
            }
        }

        try {
            this.logWatcher = fs.watch(claudeDir, (_eventType, filename) => {
                if (filename && (filename.includes('buddy') || filename.includes('companion'))) {
                    const filePath = path.join(claudeDir, filename);
                    if (fs.existsSync(filePath)) {
                        this.logPath = filePath;
                        this.lastLogSize = 0;
                        this.readNewLogContent();
                    }
                }
            });
            return true;
        } catch {
            return false;
        }
    }

    private readNewLogContent(): void {
        if (!this.logPath) return;
        try {
            const stat = fs.statSync(this.logPath);
            if (stat.size <= this.lastLogSize) return;

            const fd = fs.openSync(this.logPath, 'r');
            const bufSize = stat.size - this.lastLogSize;
            const buf = Buffer.alloc(bufSize);
            fs.readSync(fd, buf, 0, bufSize, this.lastLogSize);
            fs.closeSync(fd);
            this.lastLogSize = stat.size;

            const newContent = buf.toString('utf-8');
            const bubbles = this.parser.parse(newContent);
            for (const bubble of bubbles) {
                this.callback(bubble);
            }
        } catch { /* ignore read errors */ }
    }

    setBuddyName(name: string): void {
        this.parser.setBuddyName(name);
    }

    getMode(): string {
        return this.mode;
    }

    dispose(): void {
        if (this.parseTimer) {
            clearTimeout(this.parseTimer);
            this.parseTimer = null;
        }
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.parser.reset();
        this.screen.reset();
        this.spokenTexts.clear();
    }
}
