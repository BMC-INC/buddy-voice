import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BubbleParser, ParsedBubble } from './bubbleParser';

export type BubbleCallback = (bubble: ParsedBubble) => void;

export class TerminalMonitor {
    private parser: BubbleParser;
    private callback: BubbleCallback;
    private disposables: vscode.Disposable[] = [];
    private mode: 'terminal-data' | 'log-watcher' | 'none' = 'none';
    private logWatcher: fs.FSWatcher | null = null;
    private lastLogSize: number = 0;
    private logPath: string = '';

    constructor(buddyName: string, callback: BubbleCallback) {
        this.parser = new BubbleParser(buddyName);
        this.callback = callback;
    }

    /**
     * Start monitoring. Returns the active mode.
     */
    start(): string {
        // Try Option A: Terminal data events (proposed API)
        if (this.tryTerminalDataAPI()) {
            this.mode = 'terminal-data';
            return this.mode;
        }

        // Fall back to Option C: Log file watcher
        if (this.tryLogWatcher()) {
            this.mode = 'log-watcher';
            return this.mode;
        }

        this.mode = 'none';
        return this.mode;
    }

    private tryTerminalDataAPI(): boolean {
        try {
            // onDidWriteTerminalData is a proposed API
            // Check if it's available on the window object
            const onDidWrite = (vscode.window as any).onDidWriteTerminalData;
            if (typeof onDidWrite === 'function') {
                const disposable = onDidWrite((e: { terminal: vscode.Terminal; data: string }) => {
                    const bubbles = this.parser.parse(e.data);
                    for (const bubble of bubbles) {
                        this.callback(bubble);
                    }
                });
                this.disposables.push(disposable);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    private tryLogWatcher(): boolean {
        // Watch Claude Code's log directory for buddy output
        const claudeDir = path.join(os.homedir(), '.claude');
        if (!fs.existsSync(claudeDir)) return false;

        // Look for any log files that might contain buddy output
        const logCandidates = [
            path.join(claudeDir, 'buddy.log'),
            path.join(claudeDir, 'companion.log'),
        ];

        // Also check for the most recent log file in .claude/logs/
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
                        if (eventType === 'change') {
                            this.readNewLogContent();
                        }
                    });
                    return true;
                } catch { continue; }
            }
        }

        // Watch the .claude directory itself for new files
        try {
            this.logWatcher = fs.watch(claudeDir, (eventType, filename) => {
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
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
        if (this.logWatcher) {
            this.logWatcher.close();
            this.logWatcher = null;
        }
        this.parser.reset();
    }
}
