# Frostwig

Give your Claude Code buddy a voice.

You can already talk to your buddy by name in Claude Code — just type "Frostwig, what do you think?" and Claude steps aside while your buddy responds in character. That's built into Claude Code natively. The problem is those responses are text only. Frostwig makes them audible.

## Two Modes

### CLI Mode

A lightweight REPL where you have a dedicated voice conversation with your buddy. You type, buddy responds in character via the Anthropic API, and the response is spoken aloud through macOS `say`.

```bash
cd packages/cli
npm link
frostwig
```

Requires `ANTHROPIC_API_KEY` environment variable.

Commands: `/voice on|off`, `/voice set <name>`, `/voice list`, `/stats`, `/pet`, `/mute`, `/quit`

### VS Code Extension Mode

Monitors the terminal where Claude Code is running. When your buddy drops a speech bubble or responds to you by name, the extension catches that text and speaks it. Use this when you're coding and want to hear buddy commentary hands-free.

```bash
cd packages/vscode
npm install
npm run compile
npx vsce package
code --install-extension frostwig-voice-1.0.0.vsix
```

Once installed, open a terminal in VS Code with Claude Code running. Your buddy's speech gets spoken automatically. Click the status bar item to toggle voice on/off.

## Requirements

- Node.js 18+
- macOS `say` command (for voice output)
- `ANTHROPIC_API_KEY` env var (CLI mode only)
- Claude Code with `/buddy` activated

## What This Does NOT Do

- Does not draw characters or ASCII art
- Does not modify Claude Code's behavior
- Does not intercept or alter terminal input
- Does not collect telemetry

## About

Built by [James Benton Jr.](https://linkedin.com/in/james-benton-execlayer/) / [ExecLayer Inc.](https://github.com/BMC-INC)

Not affiliated with or endorsed by Anthropic.

## License

MIT
