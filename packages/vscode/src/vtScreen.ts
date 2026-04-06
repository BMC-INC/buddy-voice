/**
 * Minimal virtual terminal screen buffer.
 * Processes ANSI cursor-movement sequences to reconstruct the 2D visual layout
 * that Claude Code's Ink-based TUI renders via cursor positioning.
 */

export class VTermScreen {
    private grid: Map<number, string[]> = new Map();
    private cursorRow: number = 0;
    private cursorCol: number = 0;
    private dirtyRows: Set<number> = new Set();

    feed(data: string): Set<number> {
        this.dirtyRows.clear();
        let i = 0;

        while (i < data.length) {
            const ch = data[i];

            if (ch === '\x1b') { i = this.parseEsc(data, i); continue; }
            if (ch === '\r') { this.cursorCol = 0; i++; continue; }
            if (ch === '\n') { this.cursorRow++; i++; continue; }
            if (ch === '\t') { this.cursorCol = (Math.floor(this.cursorCol / 8) + 1) * 8; i++; continue; }
            if (ch === '\x08') { if (this.cursorCol > 0) this.cursorCol--; i++; continue; }
            if (ch.charCodeAt(0) < 0x20) { i++; continue; }

            this.putChar(ch);
            i++;
        }

        return new Set(this.dirtyRows);
    }

    getLine(row: number): string {
        const cells = this.grid.get(row);
        if (!cells) return '';
        return cells.join('').trimEnd();
    }

    getScreen(): string {
        if (this.grid.size === 0) return '';
        const minRow = Math.min(...this.grid.keys());
        const maxRow = Math.max(...this.grid.keys());
        const lines: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
            lines.push(this.getLine(r));
        }
        return lines.join('\n');
    }

    reset(): void {
        this.grid.clear();
        this.cursorRow = 0;
        this.cursorCol = 0;
        this.dirtyRows.clear();
    }

    private putChar(ch: string): void {
        let row = this.grid.get(this.cursorRow);
        if (!row) {
            row = [];
            this.grid.set(this.cursorRow, row);
        }
        while (row.length <= this.cursorCol) {
            row.push(' ');
        }
        row[this.cursorCol] = ch;
        this.dirtyRows.add(this.cursorRow);
        this.cursorCol++;
    }

    private parseEsc(data: string, pos: number): number {
        if (pos + 1 >= data.length) return pos + 1;
        const next = data[pos + 1];

        if (next === '[') return this.parseCSI(data, pos + 2);

        if (next === ']') {
            let j = pos + 2;
            while (j < data.length) {
                if (data[j] === '\x07') return j + 1;
                if (data[j] === '\x1b' && j + 1 < data.length && data[j + 1] === '\\') return j + 2;
                j++;
            }
            return j;
        }

        return pos + 2;
    }

    private parseCSI(data: string, pos: number): number {
        let params = '';
        let j = pos;

        if (j < data.length && (data[j] === '?' || data[j] === '>' || data[j] === '!')) {
            params += data[j];
            j++;
        }

        while (j < data.length && ((data[j] >= '0' && data[j] <= '9') || data[j] === ';')) {
            params += data[j];
            j++;
        }

        if (j >= data.length) return j;
        const cmd = data[j];
        j++;

        const cleanParams = params.replace(/^[?>!]/, '');
        const nums = cleanParams.split(';').map(s => (s === '' ? 0 : parseInt(s, 10)));

        switch (cmd) {
            case 'A': this.cursorRow -= (nums[0] || 1); if (this.cursorRow < 0) this.cursorRow = 0; break;
            case 'B': this.cursorRow += (nums[0] || 1); break;
            case 'C': this.cursorCol += (nums[0] || 1); break;
            case 'D': this.cursorCol -= (nums[0] || 1); if (this.cursorCol < 0) this.cursorCol = 0; break;
            case 'H': case 'f':
                this.cursorRow = (nums[0] || 1) - 1;
                this.cursorCol = (nums.length > 1 ? (nums[1] || 1) : 1) - 1;
                break;
            case 'G': this.cursorCol = (nums[0] || 1) - 1; break;
            case 'J':
                if (nums[0] === 2 || nums[0] === 3) this.reset();
                break;
            case 'K': {
                const mode = nums[0] || 0;
                const row = this.grid.get(this.cursorRow);
                if (row) {
                    if (mode === 0) row.length = this.cursorCol;
                    else if (mode === 1) { for (let c = 0; c <= this.cursorCol && c < row.length; c++) row[c] = ' '; }
                    else if (mode === 2) row.length = 0;
                    this.dirtyRows.add(this.cursorRow);
                }
                break;
            }
            case 'm': break;
        }

        return j;
    }
}
