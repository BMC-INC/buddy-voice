# Frostwig — Claude Code Project Config

## What This Tool Actually Does

The user can already talk to their buddy by name in Claude Code. Claude steps aside and the buddy responds in its own personality. This is built into Claude Code natively.

The problem: those responses are text only. This tool makes them audible. Two modes:

1. **CLI Mode:** A lightweight REPL where you have a dedicated voice conversation with your buddy. You type, buddy responds in character via the Anthropic API, and the response is spoken aloud through macOS `say`.

2. **VS Code Extension Mode:** Monitors the terminal where Claude Code is running. When the buddy drops a speech bubble or responds by name, the extension catches that text and speaks it hands-free.

Both modes give the buddy a voice. Neither mode draws anything visual. The buddy's appearance is handled by Claude Code.

## Architecture

```
frostwig/
  packages/
    cli/
      bin/frostwig.mjs        # Interactive REPL, API calls, voice output
      package.json
    vscode/
      src/
        extension.ts           # Activation, commands, lifecycle
        terminalMonitor.ts     # Watches terminal for buddy speech
        bubbleParser.ts        # Extracts plain text from speech patterns
        tts.ts                 # TTS engine with speech queue
        config.ts              # Extension settings reader
        statusBar.ts           # Status bar toggle
      package.json
      tsconfig.json
    shared/
      tts.mjs                  # macOS say wrapper, speech queue
      config.mjs               # Reads ~/.claude.json companion data
      parser.mjs               # Shared bubble text extraction
  package.json                 # npm workspace root
  README.md
  CLAUDE.md
  LICENSE
```

## Design Rules

- Zero visual rendering. No ASCII art, no sprites, no speech bubble boxes, no animation.
- Zero npm dependencies. Node stdlib and fetch only.
- Fire-and-forget TTS. Don't await speech completion.
- Speech queue. New text queues behind current speech, never overlaps.
- Read-only. Never modify Claude Code behavior or terminal input.
- No telemetry. No phone home. No data collection.

## Git Workflow

Push directly to main. No PRs or branches unless asked.
