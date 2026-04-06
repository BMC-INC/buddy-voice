import { spawn, execSync } from 'child_process';
import * as vscode from 'vscode';

export class TTSEngine {
    private queue: string[] = [];
    private speaking: boolean = false;
    private enabled: boolean = true;
    private muted: boolean = false;
    private voice: string = 'Samantha';
    private rate: number = 180;
    private speakingTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.loadSettings();
    }

    loadSettings(): void {
        const config = vscode.workspace.getConfiguration('frostwig');
        this.enabled = config.get('enabled', true);
        this.voice = config.get('voice', 'Samantha');
        this.rate = config.get('rate', 180);
    }

    speak(text: string): void {
        if (!this.enabled || this.muted || !text.trim()) return;
        this.queue.push(text);
        this.processQueue();
    }

    private processQueue(): void {
        if (this.speaking || this.queue.length === 0) return;
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

        // Failsafe: reset speaking flag after 15s in case process events never fire
        if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
        this.speakingTimeout = setTimeout(() => {
            this.speaking = false;
            this.processQueue();
        }, 15000);

        try {
            const proc = spawn('/usr/bin/say', ['-v', this.voice, '-r', String(this.rate), cleaned]);
            proc.on('close', () => {
                if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
                this.speaking = false;
                this.processQueue();
            });
            proc.on('error', () => {
                if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
                this.speaking = false;
                this.processQueue();
            });
        } catch {
            if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
            this.speaking = false;
            this.processQueue();
        }
    }

    setVoice(voice: string): void { this.voice = voice; }
    setEnabled(enabled: boolean): void { this.enabled = enabled; }
    setMuted(muted: boolean): void { this.muted = muted; }
    isEnabled(): boolean { return this.enabled; }
    isMuted(): boolean { return this.muted; }
    getVoice(): string { return this.voice; }

    toggleVoice(): boolean {
        this.enabled = !this.enabled;
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
    }
}
