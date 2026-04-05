# frostwig-cli

Give your Claude Code Buddy a voice. Interactive conversational mode with text-to-speech for terminal pets.

Built for the [Claude Code Buddy system](https://docs.anthropic.com) launched April 2026. Works with all 18 species.

## Demo

```
  ___________________________
 | Why is that variable called |
 | "temp2"? Have some self    |
 | respect.                    |
  ---------------------------
        /
     (o>
    /|  \
     | |
    / | \
   ~~ ~~
```

## Install

```bash
npm install -g frostwig-cli

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Talk to your buddy
frostwig
```

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable
- Claude Code with `/buddy` activated (so your companion config exists in `~/.claude.json`)
- macOS `say` command (optional, for voice output)

## How It Works

1. Reads your buddy companion config from `~/.claude.json`
2. Extracts your buddy's name, species, rarity, personality, and stats
3. Builds a character prompt so Claude responds as your buddy, not as itself
4. Opens an interactive REPL with ASCII art and speech bubbles
5. Pipes responses through macOS `say` for voice output

## Commands

| Command | What it does |
|---|---|
| `/stats` | Show stat card with attribute bars |
| `/pet` | Pet your buddy (hearts) |
| `/sprite` | Animated ASCII sprite |
| `/mood` | Current mood based on conversation |
| `/voice on\|off` | Toggle TTS |
| `/voice set <n>` | Change macOS voice |
| `/voice list` | List available voices |
| `/clear` | Reset conversation |
| `/quit` | Exit |

## Flags

```bash
frostwig              # Default, voice enabled
frostwig --no-voice   # Text only
frostwig --voice=Fred # Specific macOS voice
```

## Species Support

Works with all 18 Claude Code Buddy species. Each species gets a default voice mapped to its vibe. You can always override with `/voice set`.

## About

Built by [James Benton Jr.](https://linkedin.com/in/james-benton-execlayer/) / [ExecLayer Inc.](https://github.com/BMC-INC)

This project is not affiliated with or endorsed by Anthropic. It reads user-owned companion config data and builds an independent conversational layer on top of it.

## License

MIT
