# roblesagentloop
<img width="1660" height="852" alt="Captura de pantalla 2026-10-15 091110" src="https://github.com/user-attachments/assets/52a1ce0c-649c-4016-8876-83db98cd6281" />

Claude Code (Opus) plans small, verifiable tasks. Codex CLI implements each task in a separate Git worktree, runs automated checks and gets a read-only JSON review. Failed checks or reviews return to the executor within a bounded round budget.

The architect reviews the result and integrates it into `main`. Integration uses `git merge --no-ff --no-commit`, reruns checks and aborts on failure before creating a merge commit. No push or deployment without human confirmation.

## Install

Requires Git, Node.js, authenticated Claude Code and Codex CLI, and Windows PowerShell 5.1 or PowerShell 7. Python checks additionally need uv, ruff, mypy and pytest. Both AI tools require suitable subscriptions or API access. The architect uses Anthropic tokens; execution and review use Codex usage. No credits are included.

```powershell
git clone https://github.com/robles-23/roblesagentloop.git
cd roblesagentloop
.\install.ps1 -Target C:\dev\my-project
```

Existing files are skipped unless you pass `-Force`. Merge skipped rules/settings manually. Fill the placeholders in `AGENTS.md` and `CLAUDE.md`, edit `agentloop.config.json`, ignore runtime directories, and commit the template and task to your project's `main` branch. The installer never commits.

Inside Claude Code:

```text
/plugin marketplace add robles-23/roblesagentloop
/plugin install agentloop-flota@roblesagentloop
/plugin install agentloop-guardas@roblesagentloop
```
<img width="340" height="168" alt="Captura de pantalla 2026-10-15 171350" src="https://github.com/user-attachments/assets/fc18bfb3-2363-42d6-a937-d5a2450ad001" />

Restart the session. Mods need a Claude Code build with the TypeScript mod runtime. The scripts work independently of the display mods.

Follow the [first-task tutorial](docs/primera-tarea.md) to configure its README check, then run from your project:

```powershell
powershell -NoProfile -File scripts/agent/run-task.ps1 -Id T-001
node scripts/agent/board.mjs
# After the architect reviews the summary and verdict:
powershell -NoProfile -File scripts/agent/merge-task.ps1 -Id T-001
```

Configure `executor`, `reviewer`, `criticalReviewer`, `maxRounds`, `staleMinutes`, `worktreeRoot` and custom `gates`. Defaults use the model IDs in [the example configuration](agentloop.config.example.json); account access is not guaranteed. Critical tasks cover permissions, money, external sends and secrets.

`-ReviewOnly` skips the first implementation step. Restarts keep round numbering and reviewer feedback. Infrastructure failures exit with code 2 and return to the architect without consuming a correction round. PowerShell 7 paths are portable in design; macOS/Linux have not been verified. VS Code tasks use `powershell` by default; change that to `pwsh` there.

The secret hook and host guards inspect tool arguments, not arbitrary program behavior. They complement sandbox and network permissions; the Claude hook does not apply to Codex CLI.

Full guides are in [Spanish](README.md). MIT, © 2026 [Óscar Robles](https://github.com/robles-23).
