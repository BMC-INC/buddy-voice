<div align="center">

<br>

# buddy-voice

### Your Claude Code buddy already talks. Now it speaks.

<br>

<img src="https://img.shields.io/badge/Claude_Code-Buddy_Voice-6c5ce7?style=for-the-badge" alt="Claude Code Buddy Voice" />
<img src="https://img.shields.io/badge/macOS-TTS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS TTS" />
<img src="https://img.shields.io/badge/Zero_Dependencies-00cec9?style=for-the-badge" alt="Zero Dependencies" />
<img src="https://img.shields.io/badge/License-MIT-2ecc71?style=for-the-badge" alt="MIT License" />

<br><br>

```
  you > Hey Frostwig, what do you think of my code?

  Frostwig: Your variable names look like you were
  fighting the keyboard and losing.
                                          🔊 *spoken aloud*
```

*Examples show Frostwig (penguin) — your buddy's name and personality will be different.*

<br>

**You already talk to your buddy in Claude Code. This makes it talk back — out loud.**

**Works with all 18 species.** Penguin, dragon, cat, ghost, robot, owl — whatever `/buddy` gave you.



[CLI Mode](#cli-mode) · [VS Code Extension](#vs-code-extension) · [How It Works](#how-it-works) · [Install](#install)

<br>

</div>

---

## The Problem

Claude Code shipped `/buddy` — a companion pet that lives in your terminal. Penguin, dragon, cat, robot, whatever you got. You talk to it by name, it responds in character. It has personality. It has opinions. It has stats.

But it's silent. The responses scroll by as text while you're staring at code. You miss half of them.

**buddy-voice makes your buddy audible.** Every response, every quip, every unsolicited opinion about your variable names — spoken aloud through your speakers.

---

## Two Modes, One Job

### CLI Mode

A dedicated conversation with your buddy. You type, it responds in character, you hear it.

```
  you > What's your debugging strategy?

  Frostwig: Step 1: Stare at the code. Step 2: Stare harder.
  Step 3: Add a console.log. Step 4: Regret everything.
                                                    🔊
```

```
  you > /stats

  Frostwig the penguin (legendary)
  DEBUGGING: 7/10
  PATIENCE: 4/10
  CHAOS: 8/10
  WISDOM: 6/10
  SNARK: 9/10
```

```
  you > /pet

  Frostwig: *happy penguin noises*
                              🔊
```

### VS Code Extension

Hands-free. Monitors your terminal while you code with Claude Code. When your buddy drops a comment, you hear it automatically. Never miss a quip again.

- Status bar toggle — click to mute/unmute
- Works with all 18 buddy species
- Command palette: change voice, test voice, view stats
- Detects speech bubbles, name-prefixed lines, and face icons

---

## Install

### Easiest: CLAUDE.md Instruction (Recommended)

No install needed. Add this to your `~/CLAUDE.md` (global) or any project's `CLAUDE.md`:

```markdown
## Buddy Voice

When the companion (any /buddy pet) speaks — whether the user addresses
it by name or it drops a comment — run the response through macOS TTS:

  say -v Samantha -r 180 "<response text>"

Fire and forget. Don't await. Just speak it every time the buddy responds.
```

That's it. Next Claude Code session, your buddy talks out loud. No tools, no extensions, no dependencies. Claude sees the instruction and speaks every buddy response automatically.

**Change the voice:** Replace `Samantha` with any macOS voice (`Daniel` for deep, `Karen` for smooth, `Fred` for quirky). Run `say -v '?'` to see all options.

### CLI (Standalone Conversations)

```bash
git clone https://github.com/BMC-INC/buddy-voice.git
cd buddy-voice/packages/cli
npm link
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
buddy-voice
```

That's it. You're talking to your buddy.

### VS Code Extension

```bash
cd buddy-voice/packages/vscode
npm install
npm run compile
npx vsce package
code --install-extension frostwig-voice-1.0.0.vsix
```

Open a terminal in VS Code, run Claude Code, activate `/buddy`. You'll hear it.

---

## How It Works

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  CLI Mode                                            │
│                                                      │
│  You type ──> Anthropic API ──> Buddy responds       │
│                                  in character         │
│                                    │                  │
│                                    ▼                  │
│                              macOS say 🔊             │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  VS Code Extension Mode                              │
│                                                      │
│  Claude Code terminal ──> Monitor detects             │
│  buddy speech bubble      buddy speech                │
│                              │                        │
│                              ▼                        │
│                        macOS say 🔊                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**CLI Mode** calls the Anthropic API directly. Your buddy's name, personality, and stats are loaded from `~/.claude.json` (written by Claude Code's `/buddy` command). The system prompt makes Claude respond as your buddy — not as Claude. Responses are spoken through macOS `say`.

**VS Code Extension** doesn't call any API. It watches terminal output for buddy speech patterns — face icons like `(o>`, pipe-delimited speech bubbles, and name-prefixed lines like `Frostwig: text`. When it detects one, it extracts the plain text and speaks it. Fire and forget.

Both use a **speech queue** — if your buddy drops two quips in a row, they play sequentially, never overlap.

---

## CLI Commands

| Command | What it does |
|:--------|:-------------|
| `/voice on\|off` | Toggle TTS |
| `/voice set <name>` | Change macOS voice (try Daniel, Karen, Fred) |
| `/voice list` | List all available voices |
| `/stats` | Show buddy's name, species, rarity, and stat scores |
| `/pet` | Pet your buddy |
| `/mute` | Mute voice |
| `/quit` | Exit |

---

## Requirements

| What | Why |
|:-----|:----|
| Node.js 18+ | Runtime |
| macOS | TTS via `say` command (text-only fallback on other OS) |
| `ANTHROPIC_API_KEY` | CLI mode only — powers the conversation |
| Claude Code with `/buddy` | So your buddy config exists in `~/.claude.json` |

---

## Works With Every Buddy Species

Your buddy is whatever Claude Code gave you. Penguin, dragon, cat, ghost, robot, owl, fox, bear, bunny, frog, unicorn, bat, wolf, turtle, snake, hamster, phoenix — doesn't matter. buddy-voice reads the config and adapts.

---

## What This Does NOT Do

- **Does not draw anything.** Your buddy's appearance is Claude Code's job.
- **Does not modify Claude Code.** Read-only. We just listen.
- **Does not collect data.** Zero telemetry. Zero phone home.
- **Does not have npm dependencies.** Node stdlib and fetch. That's it.

---

## Project Structure

```
buddy-voice/
  packages/
    cli/          # Interactive REPL with voice
    vscode/       # VS Code extension
    shared/       # TTS engine, config reader, speech parser
  package.json    # npm workspace root
```

---

<div align="center">

<br>

Built by [**James Benton Jr.**](https://linkedin.com/in/james-benton-execlayer/) / [**ExecLayer Inc.**](https://github.com/BMC-INC)

Not affiliated with or endorsed by Anthropic. We just really like talking to penguins.

MIT License

<br>

</div>
