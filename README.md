# Buddy Voice

**Local speech for a terminal companion, with a standalone chat CLI and an experimental VS Code integration.**

Buddy Voice adds macOS text-to-speech to a Claude Code companion experience.
Speech uses the built-in `say` engine. The standalone CLI generates replies
through the Anthropic API; the editor integration detects speech in local
terminal output when the editor exposes the required capability.

[Watch the demo](https://github.com/BMC-INC/buddy-voice/issues/1) · [Contribute](https://github.com/BMC-INC/buddy-voice/blob/main/CONTRIBUTING.md) · [Report an issue](https://github.com/BMC-INC/buddy-voice/issues)

## Choose an experience

| Mode | What it does | Requirements and status |
| --- | --- | --- |
| Instruction-based speech | Asks your existing coding assistant to speak companion replies | macOS and an assistant allowed to run local tools; behavior depends on instruction following |
| Standalone CLI | A text chat with spoken replies and local companion identity | Node.js 18+, an Anthropic API key, macOS for voice; source installation |
| VS Code extension | Watches supported terminal output or an existing companion log | macOS; experimental, editor-dependent; build from source |

This is a small developer-experience utility. It does not modify Claude Code,
control its companion UI, or provide speech recognition. It is independent of
Anthropic and is not an official Claude Code integration.

## Standalone CLI

Clone the repository and run the entry point directly. The CLI uses Node's built-in
modules and `fetch`; no npm runtime packages are required.

```bash
git clone https://github.com/BMC-INC/buddy-voice.git
cd buddy-voice
node packages/cli/bin/frostwig.mjs --help
```

Set `ANTHROPIC_API_KEY` in your shell using your usual secret-management method,
then start a conversation:

```bash
node packages/cli/bin/frostwig.mjs
```

Use `--no-voice` for text-only mode. The CLI reads the `companion` field from
`~/.claude.json` when available and otherwise uses Frostwig, the default penguin.
It keeps conversation history in memory for the current process.

| Command | Action |
| --- | --- |
| `/voice on` or `/voice off` | Enable or stop speech |
| `/voice list` | List installed macOS voices |
| `/voice set Samantha` | Change the voice |
| `/stats` | Display the local companion's attributes |
| `/pet` | Print a companion interaction |
| `/mute` | Stop current and queued speech |
| `/quit` | Exit |

The default API model is `claude-sonnet-4-6`. Set `ANTHROPIC_MODEL` to another
Messages API model available to your account. API usage is billed by Anthropic;
a Claude Code subscription does not supply this CLI with an API key. Check
[Anthropic's model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations)
when changing models. Requests time out after 30 seconds, and failed exchanges
do not become conversation history.

## Use speech in your existing assistant

If your assistant supports project instructions and local command execution,
you can add this instruction to its project configuration:

> When the companion replies, also speak the reply through macOS `say`, using
> the Samantha voice at 180 words per minute. Pass the text through standard
> input rather than interpolating it into a shell command. Keep normal text
> output available and do not wait for speech to finish before continuing.

This is an instruction-based integration, so reliability depends on the assistant
and its tool permissions. Buddy Voice does not install or enforce that instruction.

## Build the VS Code extension

Building and packaging requires **Node.js 22+** and npm. From the repository root:

```bash
npm ci
npm test
npm run package:extension
code --install-extension packages/vscode/frostwig-voice-1.0.1.vsix
```

The package includes the extension, README, and MIT license. Use the `Frostwig`
commands in the command palette to test a voice, change it, or mute speech.

**Compatibility boundary:** automatic narration depends on the editor exposing
`onDidWriteTerminalData`, or on an existing `~/.claude/buddy.log` or
`~/.claude/companion.log`. These logs are not guaranteed to be produced by Claude
Code. When neither input is available, the extension reports that monitoring is
unavailable; use the CLI or instruction-based mode. The extension is not presented
as a released Marketplace product.

Detection is heuristic: changes to terminal rendering can cause missed or
incorrect matches. Test it with your editor and companion before relying on
hands-free narration. Windows and Linux voice backends are not implemented.

## Privacy

- Text-to-speech is generated locally by macOS; no cloud speech service is used.
- The CLI sends the conversation and companion identity to Anthropic to generate
  replies. It does not send repository files or terminal output.
- The extension reads terminal output or the two named local companion logs.
  It does not upload or persist captured text and does not alter terminal input.
- There is no telemetry. VS Code may display detected text in notifications,
  controlled by `frostwig.showNotification`.

Earlier source versions wrote a `~/frostwig-debug.log` file while monitoring.
Current code no longer writes that file; an existing file is not removed automatically.

## Development and validation

`npm test` compiles the extension and runs automated tests for parsing, request
ordering and failure recovery, and speech queue behavior. `npm run package:extension`
checks the distributable VSIX. A separate isolated smoke test also exercised activation, commands, and synthetic
companion-log monitoring in VS Code 1.133.0 on macOS. Real terminal-output narration
and authenticated Anthropic conversations still need environment-specific validation.

See the [contribution guide](https://github.com/BMC-INC/buddy-voice/blob/main/CONTRIBUTING.md)
for manual checks and project boundaries. Do not include real API keys, terminal
logs, or private companion configuration in public issues.

## License

[MIT](https://github.com/BMC-INC/buddy-voice/blob/main/LICENSE).
Built by James Benton Jr. and [ExecLayer / BMC-INC](https://github.com/BMC-INC).

## Install release artifacts

The [GitHub releases page](https://github.com/BMC-INC/buddy-voice/releases) provides
a self-contained CLI package and a VS Code VSIX. For version 1.0.1:

```bash
npm install --global https://github.com/BMC-INC/buddy-voice/releases/download/v1.0.1/buddy-voice-cli-1.0.1.tgz
buddy-voice --help
```

Download `frostwig-voice-1.0.1.vsix` and choose **Extensions: Install from VSIX** in
VS Code. A GitHub artifact release does not imply npm registry or Marketplace
publication. The CLI still requires your Anthropic API key for conversations.

The tag-triggered release workflow checks all package versions, runs the tests and
security audit, and publishes artifacts plus SHA-256 checksums. Release tags must
point to a reviewed commit whose version matches the tag. The package test installs
the actual CLI tarball in an isolated directory before running it.

### Build dependency exception

The VSIX packaging tool currently pulls an affected MSAL authentication dependency.
A temporary override selects patched `@azure/msal-node` 7.1.2 inside `@azure/identity`
for [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5).
This crosses the upstream declared MSAL range and is limited to development tools;
the CLI and VSIX have no npm runtime dependencies. Packaging, credential/client
construction, and required method interfaces have been checked with Node 22+.
Authenticated Azure/Marketplace publishing has not been validated. Remove the
override when the publishing tool adopts a patched version and repeat the checks.

For an isolated real-editor smoke check after compiling, run:

```bash
node scripts/test-editor.mjs "/Applications/Visual Studio Code.app/Contents/MacOS/Code"
```

It uses a temporary home/profile with synthetic companion logs, disables speech,
and checks activation, commands, log append/truncation/rotation, and absence of
legacy debug captures. It never reads the user's terminal contents or companion logs.
