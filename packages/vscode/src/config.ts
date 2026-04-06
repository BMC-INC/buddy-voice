import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface BuddyIdentity {
    name: string;
    species: string;
    rarity: string;
    personality: string;
    stats: Record<string, number>;
}

export function loadBuddyConfig(): BuddyIdentity | null {
    const configPath = join(homedir(), '.claude.json');
    if (!existsSync(configPath)) return null;

    try {
        const raw = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw);
        const companion = config.companion;
        if (!companion) return null;

        return {
            name: companion.name || 'Frostwig',
            species: companion.species || 'penguin',
            rarity: companion.rarity || 'unknown',
            personality: companion.personality || 'A mysterious companion.',
            stats: companion.stats || { DEBUGGING: 5, PATIENCE: 5, CHAOS: 5, WISDOM: 5, SNARK: 5 },
        };
    } catch { return null; }
}

export function getBuddyName(): string {
    const config = vscode.workspace.getConfiguration('frostwig');
    const override = config.get<string>('buddyName', '');
    if (override) return override;

    const buddy = loadBuddyConfig();
    return buddy?.name || 'Frostwig';
}

export function getVoiceSetting(): string {
    return vscode.workspace.getConfiguration('frostwig').get('voice', 'Daniel');
}

export function isEnabled(): boolean {
    return vscode.workspace.getConfiguration('frostwig').get('enabled', true);
}

export function shouldShowNotification(): boolean {
    return vscode.workspace.getConfiguration('frostwig').get('showNotification', true);
}
