# Frostwig CLI

## What This Is

A standalone CLI tool that gives Claude Code Buddy pets an interactive conversational mode with text-to-speech. Users can talk to their buddy (penguin, cat, dragon, whatever they got) in real-time through the terminal with voice output via macOS `say`.

This is NOT a fork or modification of Claude Code. It reads the buddy config that Claude Code writes to `~/.claude.json` and builds a separate conversational layer on top of it.

## Architecture

```
frostwig-cli/
  bin/
    frostwig.mjs          # CLI entrypoint, REPL loop, slash commands
  lib/
    config.mjs            # Read ~/.claude.json companion field, extract identity
    conversation.mjs      # Anthropic API wrapper, system prompt builder
    renderer.mjs          # ASCII sprite rendering, speech bubbles, ANSI colors
    tts.mjs               # macOS say wrapper, voice listing, voice selection
    species.mjs           # Species-specific sprite data (original art, NOT from Anthropic source)
  package.json
  README.md
  LICENSE                 # MIT
  CLAUDE.md               # This file
```

## Design Rules

- **Zero Anthropic source code.** Do not copy sprites, algorithms, or code from Claude Code's source or the leaked .map file. All ASCII art must be original. The only thing we read is the companion config object from ~/.claude.json, which is user data.
- **Species-agnostic.** Works with all 18 buddy species. Detect species from config and load appropriate original sprite art.
- **Personality-faithful.** Read the buddy's name, personality description, and stats from config. Build a system prompt that makes Claude respond as that character, not as Claude.
- **Short responses.** Max 200 tokens per response. These are quips, not essays. The buddy is a companion, not an assistant.
- **macOS TTS first.** Use the `say` command. Support voice selection. Default to something that sounds good for the species (higher pitch for small animals, lower for dragons, etc.).
- **Graceful fallback.** If no buddy config exists, prompt the user to run /buddy in Claude Code first. If no API key, give clear instructions. If no say command (Linux), fall back to text only with a note.
- **No dependencies beyond Node.js stdlib and fetch.** This ships as a single npm package with zero deps.

## Slash Commands

| Command | Behavior |
|---|---|
| /stats | Render stat card with ASCII bars |
| /pet | Hearts animation + happy response |
| /sprite | Cycle through 3 animation frames |
| /voice on/off | Toggle TTS |
| /voice set <name> | Change macOS voice |
| /voice list | List available voices |
| /mood | Show current mood based on recent interactions |
| /clear | Reset conversation history |
| /quit | Exit with farewell message |

## System Prompt Structure

Build the system prompt from the buddy config:

```
You are {name}, a {rarity} {species} who lives in a developer's terminal.

PERSONALITY: {personality from config}

STATS:
- DEBUGGING: {val}/10
- PATIENCE: {val}/10  
- CHAOS: {val}/10
- WISDOM: {val}/10
- SNARK: {val}/10

RULES:
- You are NOT Claude. You are {name}.
- Keep responses to 1-3 sentences.
- Your personality reflects your stats.
- You have strong opinions.
- If asked to do Claude's job, redirect to Claude.
```

## Voice Mapping (Default per Species)

Map species to macOS voices that feel right:
- penguin -> Samantha (clear, slightly high)
- cat -> Karen (smooth)  
- dragon -> Daniel (deep)
- duck -> Fred (quirky)
- ghost -> Whisper (if available) or Samantha at low rate
- robot -> Zarvox or Alex
- owl -> Tom (measured)
- Default -> Samantha

User can always override with /voice set.

## Quality Bar

- Every command works on first try
- No placeholder code, no TODOs
- Error messages are helpful and specific
- The README is clear enough that someone can install and run in under 60 seconds
- ASCII art is original and looks good in standard terminal fonts
- The experience is fun. If it's not fun, it's not done.

## Testing

- Test with buddy config present and absent
- Test with API key present and absent
- Test all slash commands
- Test TTS on macOS
- Test graceful degradation on Linux (no say command)
- Verify no Anthropic copyrighted content is included

## npm Publishing

Package name: `frostwig-cli` (or `buddy-voice` if we want species-agnostic branding)
Binary name: `frostwig`
Entry: `bin/frostwig.mjs`
Node: >=18
Zero runtime dependencies
