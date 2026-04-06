# Contributing to buddy-voice

Thanks for wanting to help make terminal pets louder.

This repo is small on purpose. Please keep contributions simple, honest, and production-ready. No placeholder code, no half-built abstractions, and no "we'll finish this later" scaffolding.

## What This Project Is

`buddy-voice` gives Claude Code's `/buddy` companion a voice.

There are two main shipping surfaces:

- `packages/cli`: a standalone REPL that talks to your buddy through the Anthropic Messages API and speaks replies with macOS `say`
- `packages/vscode`: a VS Code extension that watches terminal output locally and speaks detected buddy lines

Shared helpers live in `packages/shared`.

## Before You Start

Please read these first:

- [README.md](./README.md)
- [CLAUDE.md](./CLAUDE.md)

Those files explain the product boundaries and the design rules for the codebase.

## Ground Rules

- Keep the implementation small and direct.
- Prefer local-first behavior.
- Do not add telemetry, analytics, or phone-home behavior.
- Do not modify Claude Code behavior. This project is read-only around Claude Code.
- Avoid new dependencies unless they are clearly worth the cost.
- If you touch the voice experience, verify that speech is still fire-and-forget and queued cleanly.

## Setup

From the repo root:

```bash
npm install
```

That installs workspace dependencies for the monorepo.

## Project Layout

```text
buddy-voice/
  packages/
    cli/        # standalone buddy REPL
    vscode/     # VS Code extension
    shared/     # config loading, parser logic, TTS helpers
  demo/         # demo video and social preview assets
```

## Local Development

### CLI

From the repo root:

```bash
cd packages/cli
npm link
export ANTHROPIC_API_KEY=sk-ant-...
buddy-voice
```

Useful checks while working on the CLI:

- Run `buddy-voice --help`
- Verify `/voice list`, `/voice set`, `/stats`, and `/pet`
- Test with and without macOS TTS available if your change affects fallback behavior

### VS Code Extension

From the repo root:

```bash
cd packages/vscode
npm install
npm run compile
npx vsce package
code --install-extension frostwig-voice-1.0.0.vsix
```

Then open VS Code, run Claude Code in a terminal, enable `/buddy`, and verify:

- speech is detected from real buddy output
- mute/unmute still works
- voice selection still works
- no duplicate speech fires from the same terminal content

## What Makes a Good PR

Good contributions usually fall into one of these buckets:

- better buddy speech detection
- better TTS queue behavior
- CLI quality-of-life improvements
- Windows or Linux voice backend support
- tighter docs, demo assets, or marketplace packaging

## What to Include in a PR

Please include:

- what changed
- why it changed
- how you verified it
- screenshots or short recordings if the change affects the extension UI or README/demo assets

If you were not able to test something, say that clearly.

## Testing Expectations

This repo does not currently have a full automated test suite.

For now, manual verification is part of the contribution:

- run the CLI help command
- exercise the command paths you changed
- compile the VS Code extension if you touched extension code
- verify the README commands you changed still match reality

If you add automation, keep it lightweight and useful.

## Style Notes

- Match the existing code style in the file you are editing.
- Keep comments short and only where they help.
- Prefer explicit behavior over clever abstractions.
- Preserve the project's personality in docs, but do not overclaim what the code does.

## Ideas We Would Love Help With

- publish-ready VS Code Marketplace polish
- cross-platform TTS support
- parser coverage for future buddy UI variations
- more voice samples or demo assets
- a small automated regression harness for bubble parsing

## Questions

If something is ambiguous, open an issue or explain your reasoning clearly in the PR.

Clear tradeoffs beat silent assumptions.
