import { spawn, execSync, ChildProcess } from 'child_process';
import * as vscode from 'vscode';

export class TTSEngine {
    private queue: string[] = [];
    private speaking: boolean = false;
    private enabled: boolean = true;
    private muted: boolean = false;
    private voice: string = 'Daniel';
    private rate: number = 150;
    private currentProcess: ChildProcess | null = null;

    constructor() {
        this.loadSettings();
    }

    loadSettings(): void {
        const config = vscode.workspace.getConfiguration('frostwig');
        this.enabled = config.get('enabled', true);
        this.voice = config.get('voice', 'Daniel');
        this.rate = config.get('rate', 180);
        if (!this.enabled) this.clearQueue();
    }

    speak(text: string): void {
        if (!this.enabled || this.muted || !text.trim()) return;
        this.queue.push(text);
        this.processQueue();
    }

    private processQueue(): void {
        if (!this.enabled || this.muted || this.speaking || this.queue.length === 0) return;
        this.speaking = true;
        const text = this.queue.shift()!;
        // Strip action/emote text wrapped in asterisks (e.g. *flaps excitedly*)
        // then strip remaining special chars and collapse repeated punctuation
        const cleaned = text
            .replace(/\*[^*]+\*/g, '')
            .replace(/["`$\\*_~#<>{}[\]()]/g, '')
            .replace(/,\s*,/g, ',')
            .replace(/([.,!?;:]){2,}/g, '$1')
            .replace(/(^|[.!?])\s*[.,;:]\s*/g, '$1 ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            this.currentProcess = null;
            this.speaking = false;
            this.processQueue();
        };
        try {
            const proc = spawn('/usr/bin/say', ['-v', this.voice, '-r', String(this.rate)], {
                stdio: ['pipe', 'ignore', 'ignore'],
            });
            this.currentProcess = proc;
            proc.once('close', finish);
            proc.once('error', finish);
            proc.stdin?.on('error', () => {});
            proc.stdin?.end(cleaned);
        } catch {
            finish();
        }
    }

    setVoice(voice: string): void { this.voice = voice; }
    setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.clearQueue(); }
    setMuted(muted: boolean): void { this.muted = muted; if (muted) this.clearQueue(); }
    isEnabled(): boolean { return this.enabled; }
    isMuted(): boolean { return this.muted; }
    getVoice(): string { return this.voice; }

    toggleVoice(): boolean {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    static hasTTS(): boolean {
        try {
            execSync('which say', { stdio: 'ignore' });
            return true;
        } catch { return false; }
    }

    static listVoices(): string[] {
        try {
            const output = execSync("say -v '?'", { encoding: 'utf-8' });
            return output.split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => line.split(/\s+/)[0])
                .filter(Boolean);
        } catch { return []; }
    }

    clearQueue(): void {
        this.queue = [];
        this.currentProcess?.kill();
    }
}
