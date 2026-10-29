# Contributing to buddy-voice

Thanks for wanting to help make terminal pets louder.

This repo is small on purpose. Please keep contributions simple, honest, and production-ready. No placeholder code, no half-built abstractions, and no "we'll finish this later" scaffolding.

## What This Project Is

`buddy-voice` gives Claude Code's `/buddy` companion a voice.

There are two main shipping surfaces:

- `packages/cli`: a standalone REPL that talks to your buddy through the Anthropic Messages API and speaks replies with macOS `say`
- `packages/vscode`: a VS Code extension that watches terminal output locally and speaks detected buddy lines

CLI helpers ship inside `packages/cli/lib` so installed packages are self-contained.

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
npm ci
```

That installs workspace dependencies for the monorepo.

## Project Layout

```text
buddy-voice/
  packages/
    cli/        # standalone buddy REPL
    vscode/     # VS Code extension
    cli/lib/    # CLI config loading, conversation, TTS helpers
  demo/         # demo video and social preview assets
```

## Local Development

### CLI

From the repo root:

```bash
cd packages/cli
npm link
 # Set ANTHROPIC_API_KEY using your usual secret-management method.
buddy-voice
```

Useful checks while working on the CLI:

- Run `buddy-voice --help`
- Verify `/voice list`, `/voice set`, `/stats`, and `/pet`
- Test with and without macOS TTS available if your change affects fallback behavior

### VS Code Extension

From the repo root:

```bash
npm ci
npm test
npm run package:extension
code --install-extension packages/vscode/frostwig-voice-1.0.1.vsix
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

Run `npm test` for parser, speech queue, and request-history regression tests.
Run `npm run package:extension` to verify the VSIX, including its README and license.
Node.js 22+ is required for the extension development toolchain.

For a voice or editor change, also check the CLI help and relevant command paths,
then manually verify speech and mute behavior on macOS. Test the editor integration
only in an editor exposing the terminal-data capability or with a named companion
log. Record the editor version and any unsupported capability. Automated tests use
synthetic data and do not make paid API calls.

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

## Questions

If something is ambiguous, open an issue or explain your reasoning clearly in the PR.

Clear tradeoffs beat silent assumptions.
