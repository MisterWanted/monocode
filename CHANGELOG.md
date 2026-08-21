# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Context meter in the composer: a ring showing how much of the model context window the session is using, with exact token counts on hover. It turns amber at 75% and red at 90%.
- Context usage is read from each CLI rather than estimated, so the window matches whatever model the session actually runs. Claude Code, Codex, and OpenCode report it; Cursor does not expose token usage over ACP, so no meter is shown for Cursor sessions.
- The last context reading is stored with the session, so reopening a closed session shows its meter right away instead of waiting for the next turn.

### Fixed

- A tab is removed from its group when its session's project no longer matches the other tabs in that group.

## [0.1.0] - 2026-08-20

First public release. macOS (Apple Silicon) only.

### Added

- Desktop UI for the coding agent CLIs already installed on your machine: Claude Code, Codex, Cursor, and OpenCode. Tabs are sessions, the composer is the input.
- Project file tree, editor with diff view, and full-text search.
- Git surface: staged and unstaged diffs, commit, push, pull, branch switching, and pull request creation.
- Session checkpoints with undo.
- Embedded terminal panes.
- In-app updater.

### Security

- `harness_exec` only runs resolver-produced harness CLIs with a fixed argument allowlist.
- Content Security Policy enabled on the webview. Production CSP excludes the Vite dev server; `devCsp` covers `tauri dev`.
- Agent markdown does not load remote images (`data:` images still work).
- Updater endpoint and minisign public key are injected at release time rather than committed, so forks do not inherit the maintainer's update channel.
- macOS release builds sign with `APPLE_SIGNING_IDENTITY` via a config overlay; the committed default remains ad-hoc `-` for community builds.

[Unreleased]: https://github.com/hardbeat920/monocode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hardbeat920/monocode/releases/tag/v0.1.0
