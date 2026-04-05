// ANSI escape code stripper
function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '');
}

export interface ParsedBubble {
    text: string;
    pattern: 'face' | 'bubble' | 'named';
}

export class BubbleParser {
    private buddyName: string;
    private bubbleBuffer: string[] = [];
    private inBubble: boolean = false;

    // Common buddy face patterns across species
    private static FACE_PATTERNS = [
        /\(o>\s*"(.+?)"/,          // penguin
        /=\^\.?\^=\s*"(.+?)"/,     // cat
        /\{o,o\}\s*"(.+?)"/,       // owl
        />\(\)\s*"(.+?)"/,         // dragon
        /~\(o\)~\s*"(.+?)"/,      // ghost
        /\[o_o\]\s*"(.+?)"/,      // robot
    ];

    // Bubble boundaries
    private static BUBBLE_TOP = /^\s*_{3,}\s*$/;
    private static BUBBLE_LINE = /^\s*\|\s*(.+?)\s*\|\s*$/;
    private static BUBBLE_BOTTOM = /^\s*-{3,}\s*$/;

    constructor(buddyName: string = 'Frostwig') {
        this.buddyName = buddyName;
    }

    setBuddyName(name: string): void {
        this.buddyName = name;
    }

    /**
     * Parse a chunk of terminal output and return any detected buddy speech.
     * Call this with each chunk of terminal data.
     */
    parse(data: string): ParsedBubble[] {
        const clean = stripAnsi(data);
        const results: ParsedBubble[] = [];
        const lines = clean.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Pattern 1: Face + quoted speech
            for (const pattern of BubbleParser.FACE_PATTERNS) {
                const match = trimmed.match(pattern);
                if (match) {
                    results.push({ text: match[1], pattern: 'face' });
                    break;
                }
            }

            // Pattern 2: ASCII bubble block
            if (BubbleParser.BUBBLE_TOP.test(trimmed)) {
                this.inBubble = true;
                this.bubbleBuffer = [];
                continue;
            }

            if (this.inBubble) {
                const lineMatch = trimmed.match(BubbleParser.BUBBLE_LINE);
                if (lineMatch) {
                    this.bubbleBuffer.push(lineMatch[1].trim());
                    continue;
                }

                if (BubbleParser.BUBBLE_BOTTOM.test(trimmed)) {
                    this.inBubble = false;
                    if (this.bubbleBuffer.length > 0) {
                        results.push({
                            text: this.bubbleBuffer.join(' '),
                            pattern: 'bubble'
                        });
                    }
                    this.bubbleBuffer = [];
                    continue;
                }
            }

            // Pattern 3: Name-prefixed speech
            // Match "BuddyName: some text" but not paths or timestamps
            const namePattern = new RegExp(`^${escapeRegex(this.buddyName)}:\\s+(.+)$`, 'i');
            const nameMatch = trimmed.match(namePattern);
            if (nameMatch && !nameMatch[1].startsWith('/') && !nameMatch[1].match(/^\d/)) {
                results.push({ text: nameMatch[1], pattern: 'named' });
            }
        }

        return results;
    }

    /**
     * Reset parser state (e.g., when switching terminals)
     */
    reset(): void {
        this.inBubble = false;
        this.bubbleBuffer = [];
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
