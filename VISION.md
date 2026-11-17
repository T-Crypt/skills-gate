# skills-gate vision

This file is the long-term vision for skills-gate. It is a plan only. No code changes come from it directly. Later work (proposals, designs, code) must trace back to a section here.

skills-gate today is a context gate: one skill in front of every skill on the machine, with a bank, a prompt-time ranker, usage counting, pruning, a validated marketplace catalog, a trust layer, peer sync, and workflow distillation. It is one Python file, standard library only, SQLite registry, no GUI, no daemon.

The goal now is bigger: keep all of that, and add the full skill-library management surface that skills-manager provides (unified library, presets, per-agent and project workspaces, multi-tool sync, tags and filters, update tracking, preview and source inspection, custom tools, backup and multi-device sync, activity log, settings), then go beyond it. The result must be agent-native, low-context, and task-driven. An agent should be able to take a task like "build a finance trading program", query the global market, install and deploy the right skills, sync them, and prune them when they stop being used. No GUI. No human clicking through screens. Made for agents by an agent.

---

## Why this exists

Agents load every skill folder they can see. Install a hundred skills and every session starts by paying for a hundred descriptions, and the agent picks from a menu too long to read. skills-gate already fixes that by banking skills and leaving one gate visible.

But banking alone is not enough. Skills keep arriving from many sources: Git repos, local folders, archives, the skills.sh marketplace, and other tools' folders. They get edited, deployed to several agents, and copied into projects. Without a library model, an agent cannot answer "what is installed where, and is it current?" Without task awareness, provisioning is manual. Without pruning by real usage, the bank grows forever. skills-manager solves the library and deployment model, but it is GUI-first: a desktop app with a CLI bolt-on, no context gating, no pruning, no task-driven flow, and no trust layer. We want the library model without the GUI and without the context cost.

---

## Positioning

- skills-gate is the one gate in front of all skills on the machine. That does not change.
- skills-gate becomes a full global skill library and management layer, matching skills-manager's data model and feature set, but driven by CLI, hook, and MCP instead of a window.
- Context is the scarce resource. The gate stays small. Suggestions fire only on a match. Playbooks load only on `use`. Nothing is always on except what you pin.
- Made for agents. Every operation is drivable by an agent, returns JSON, is idempotent, and is safe to retry.
- Trust first. A skill never calls out without approval. New and updated skills are vetted before they reach the bank.
- Native. No daemon is required for the core. No GUI is required at all. Standard library only where it can stay that way.

---

## Core principles

1. Bank by default. Everything goes behind the gate. One gate stays visible.
2. One central library, many agents. The library is the source of truth; agent folders are deployments.
3. Agent-native. CLI, prompt hook, and MCP are the interfaces. A GUI is optional and never required.
4. Low context. Measure and cap what a session pays. Load playbooks only when needed.
5. Prune by real usage. Count loads across all harnesses and all peers. Retire what nobody uses.
6. Trust before load. Scan, check egress, review locally. Hold anything that fails.
7. Skill-aware sync. Peers merge per skill; conflicts do not block; the local copy stays put.
8. Task-driven. A task triggers discovery, install, deploy, sync, and later pruning.
9. Native and portable. Works in any shell, on any machine, with no runtime beyond Python 3.9.
10. Never commit by default. Project skills land in `.git/info/exclude` (or the VCS equivalent), so they stay local. A skill is committed only when the user asks for a committed project skill.

---

## What skills-gate already has (keep)

These exist and stay. They are the base the new layer builds on.

- The gate skill, linked into 33 known harness folders.
- BM25 prompt-time suggestions with a tuned bar, plus `bench` for measuring ranker quality.
- Usage counting from Claude Code, Pi, OMP, and Codex session logs, deduplicated across resumed sessions.
- References that hold skills (role prompts, linked folders, project manifests).
- Pruning and cold storage: stale toggles off after `prune_days`, cold storage after `cold_days`, unless pinned or referenced.
- Install scan: pipe-to-shell, decode-and-run, reverse shells, credential reads, env exfiltration, destructive commands, prompt injection, hidden or bidirectional unicode, encoded blobs, executables. High findings block. Remote installs need `--yes`.
- Archive support (`.zip`, `.skill`), with path-traversal and link refusal.
- Egress policy (`deny` / `warn` / `allow`), per-skill approvals, local and tailnet exemptions, XML namespace recognition.
- Quarantine for new and updated skills, with a local reviewer command and nightly review.
- Rollback of updates, with the previous copy kept in `cold/`.
- Upstream tracking via repo, path, commit, and folder git tree id; recovery of sources from the `npx skills` lock file; finding a moved folder by name.
- Marketplace catalog: nightly gather from skills.sh sitemaps and listed repos, per-skill validation, search, `new`, `show`, `validate`.
- Project manifests (`.skills-gate.json`), `project show/save/sync`.
- Presets and lanes.
- Peer sync through git: three-way merge per skill, key-by-key merge of shared settings, per-machine paths, usage and references aggregated across peers, hourly push, nightly pull and push.
- Workflow distillation from session logs into skill drafts, with redaction and a local draft model.
- MCP server exposing `skills_suggest`, `skills_use`, `skills_search`, `skills_lane`, `skills_show`, `skills_on`, `skills_off`.
- `doctor`, `status`, `stats`, `harvest`, `reindex`, `agents`, `timer`.

---

## What skills-manager has (parity target)

This is the feature set to match, taken from the skills-manager README and CLI. Each item maps to a skills-gate capability below.

1. Unified skill library: install from Git repos, local folders, `.zip` / `.skill` archives, or the skills.sh marketplace. One central repo, default path customizable in settings.
2. Marketplace: browse popular skills and search by keyword.
3. Agents can manage skills: install, deploy to another agent, report what is where, by driving the manager instead of writing into an agent's folder. Dashboard sets it up in one click.
4. Presets: named groups, one-time copy activation per agent scope, sidebar list.
5. Global Workspace: per-agent page listing every skill in its global folder, including ones installed outside the manager. Add or remove per agent, or use an all-agents overview.
6. Project Workspaces: view and manage project-local skill folders, compare with the central library, sync either direction, nested skill directories, per-agent assignment on export.
7. Linked Workspaces: point at any directory as a skills root, managed standalone, no preset sync.
8. Multi-tool sync: symlink or copy with one click. Per-skill agent badge per enabled agent; click to install or remove; badge reflects live state.
9. Add from Library sheet: unified picker, search central library, toggle target agents with chips (select-all/clear), batch-add.
10. Batch operations: multi-select for bulk enable/disable, export, delete. Project workspaces also bulk enable/disable for local skills.
11. Skill tagging and filters: tag skills, group by tag, filter by source or tag, including an Untagged pill.
12. Update tracking: check upstream on Git skills; re-import local ones.
13. Skill preview and source inspection: read SKILL.md / README.md, inspect source metadata, compare local content with upstream.
14. Custom tools: add agents with custom skills dirs, or override the default path for a built-in tool.
15. Backup and multi-device sync: connect a private GitHub repo or any Git remote; automatic backup; skill-aware merge; conflicts never block; snapshot versions restorable.
16. Activity log and export logs: record install/remove/update/sync; bundle into a zip for issue reports.
17. Flexible settings: repo path, sync mode, theme, text size, language, tray behavior, proxy, Git remote, update checks, agent order.
18. In-app updates: notify and install on macOS and Windows, each step one click.

---

## Gap analysis: skills-manager feature to skills-gate capability

| skills-manager feature | skills-gate today | Gap |
|---|---|---|
| Unified library install | `add` (folder, zip/skill, git URL, owner/repo) | Already covers. Needs archive and zip parity (done). |
| Marketplace browse/search | `market`, `search --market/--live` | Already covers, plus nightly validation. |
| Agents manage skills | MCP + CLI + hook | Already covers, more agent-native. |
| Presets | `preset` commands | Already covers. |
| Global Workspace per agent | `agents`, `adopt` | Missing: a per-agent view listing managed and unmanaged skills with live state. |
| Project Workspaces | `project`, `on/off` | Missing: nested skill dirs, per-agent assignment on export, compare/sync either direction as a first-class workspace. |
| Linked Workspaces | none | Missing: arbitrary skills root as a standalone workspace. |
| Multi-tool sync badges | `on/off --global`, deploy via agents | Missing: live badge state per agent on a skill card (CLI/MCP representation). |
| Add from Library sheet | none | Missing: batch picker command. |
| Batch operations | none | Missing: multi-select bulk enable/disable/export/delete. |
| Tagging and filters | tags not in core (skills-manager has) | Missing: first-class tags, tag filters, untagged pill. |
| Update tracking | `outdated`, `update`, `check` | Already covers, plus scan and review. |
| Preview and source inspection | `show`, `diff` | Missing: read SKILL.md/README in-app (CLI `cat` works; need a `preview` command). |
| Custom tools | `agents add/remove/ignore` | Missing: custom skills dirs and path overrides as first-class config. |
| Backup and multi-device sync | `remote/push/pull/join/peers` | Already covers, plus skill-aware merge. |
| Activity log and export | events in DB | Missing: export logs to zip. |
| Flexible settings | `config.json` | Already covers most. |
| In-app updates | none | Not applicable (no app). CLI self-update optional. |

---

## The improved layer: agent-native skill management

Beyond parity, skills-gate must be better for agents. These are the improvements.

### Task-driven provisioning

A single verb takes a task and does the whole job. Proposed command: `skills-gate task "<task>"` (and MCP `skills_task`). Steps:

1. Parse the task into capability needs (domains, tools, languages).
2. Search the bank first. Then, if gaps remain, search the marketplace catalog and, with approval, the live marketplaces.
3. Rank candidates with the existing BM25 ranker plus market popularity and validation status.
4. Show the short list (names, one-line descriptions, source, risk) and ask for approval before install.
5. Install approved skills with the full scan and trust flow.
6. Deploy to the agents the task needs (default: the agents active in this project's harness).
7. Write the result into the project manifest (`.skills-gate.json`) with `--save`.
8. Sync to peers if a remote is set.
9. Record everything in the activity log.

The agent never writes into an agent folder directly. It drives skills-gate.

### Context budget

Track the token cost of what a session loads. The gate already measures listing cost (389 vs 14,250 tokens). Extend this:

- `stats` reports loaded-skill token cost per session and per project.
- `suggest` and `task` respect a configurable `context_budget` (tokens). They stop adding skills once the budget is spent and say so.
- `on` warns when a load would exceed the project's budget.
- Pruning considers token cost: a heavy skill that is rarely used goes cold first.

### Pruning that depends on usage

The current tidy already retires unused skills. Make it smarter and task-aware:

- A skill used in N sessions across M projects within a window is pinned automatically (configurable).
- A skill deployed but never loaded in 14 days switches off (already).
- A skill never loaded in 120 days goes cold, unless pinned or referenced (already).
- Task-driven installs that are not used within 30 days go cold automatically, with a note that the task did not need them.
- Per-project vs global: a project can keep a skill that is cold globally, because that project still uses it.
- Cross-peer: cold storage only when no peer has used, pinned, or referenced the skill (already).

### Low-context mode

- Gate skill body stays under a fixed size budget (target: under 500 tokens). Lane table plus skill names only.
- `suggest` prints at most `suggest.limit` names with one-line descriptions.
- `use` prints the playbook once and nothing else.
- `lane` and `show` are opt-in, never automatic.
- MCP tool schemas are minimal; prefer the CLI in harnesses that have a shell.

### Native orchestration verbs

Add commands that wrap multi-step flows so an agent does not have to chain ten calls:

- `task "<task>"`: discovery, approval, install, deploy, manifest, sync.
- `provision <preset|lane|skills> [--agents ...] [--project]`: deploy a set to agents and/or project.
- `workspace add <path> [--kind global|project|linked]`: register a skills root.
- `workspace sync <path> [--direction in|out|both]`: compare and sync a workspace with the library.
- `preview <skill>`: print SKILL.md and README.md.
- `logs export [--days N] [--out path]`: bundle activity and logs into a zip.
- `context`: report current context cost and budget.

### Machine-readable everything

- Every command supports `--json`. Errors include `ok`, `code`, `message`, and structured `details`, following the skills-manager CLI convention.
- Dry-run on every write, with `--dry-run`.
- Refuse destructive operations without `--yes`, even in JSON mode.
- Conflict refusals name the exact paths, never delete, and offer adopt or move-aside (skills-manager's TARGET_CONFLICT pattern).

### No GUI dependency

- The desktop app is not required. The CLI is the product.
- A web UI may be added later as a view over the same CLI/MCP, but the core ships without it.
- Settings live in `config.json` and the SQLite DB, editable by hand or by `config` commands.

---

## Target architecture

### Storage

- Keep `~/.skills-gate/` as the home. Rename nothing; paths are already published.
- `config.json`: harness folders, always-on, thresholds, market, trust, distill, update, plus new keys: `context_budget`, `auto_pin_threshold`, `task_cold_days`, `workspaces`, `custom_agents`, `activity_log_retention_days`.
- `gate.db`: extend the schema with tables for tags, workspaces, deployments (per-agent live state), activity log, custom agents, context usage. Keep existing tables.
- `bank/<skill>/`: central library copies (already).
- `cold/<skill>/`: cold storage and pre-update copies (already).
- `workspaces/<name>/`: linked workspace roots registered by path.
- `logs/`: activity log files for export.

### Data model additions

- **Skill**: add `tags`, `token_estimate`, `source_type` (already partially), `installed_by_task`, `last_task`.
- **Deployment**: skill id, agent key, path, mode (symlink/copy), state (live/stale/missing), created_at, updated_at.
- **Workspace**: id, kind (global/project/linked), path, agent key or null, created_at.
- **Tag**: name, color (optional).
- **ActivityEvent**: timestamp, kind, skill, agent, workspace, detail, result.
- **CustomAgent**: key, name, skills_dir, enabled.
- **ContextUsage**: session id, harness, skill, tokens, timestamp.

### Agent model

- Keep the 33 known harnesses and their adapter table.
- Add custom agents with arbitrary skills directories and path overrides for built-ins.
- Each agent has a global workspace auto-registered at its skills dir.

### Project skills and version control

- Project skills are embedded into the project (copied or linked) but never committed by default.
- The exclude entry goes into `.git/info/exclude` (or the VCS equivalent), never `.gitignore`, so it stays per-machine and invisible to peers.
- A skill is committed only when the user asks for a committed project skill, via `project save --commit` or `on --commit`. That writes the skill into a normal tracked path and records the choice in the manifest.
- `project sync` on another machine reads the manifest and installs missing skills; committed skills are already in the repo, uncommitted ones are fetched from the library.
- `doctor` warns when a project skill is tracked by git but not marked committed, or marked committed but not tracked.

### Sync model

- Keep peer sync via git with skill-aware three-way merge.
- Add skill-aware merge of tags, presets, deployments, and activity-relevant settings (already mostly).
- Conflicts land in `conflicts/<skill>/` with the other peer's copy; `pull --theirs|--mine` resolves (already).
- Add `workspace sync` for comparing a project or linked workspace with the library in either direction.

### Trust model

- Keep scan, egress, quarantine, reviewer, rollback.
- Add a per-skill `approved_hosts` list that travels with sync (already).
- Add task-level approval: an agent running `task` must stop and ask before any install or net approval. The CLI prints a clear approval prompt; `--yes` is the only way to skip, and agents are told never to pass it without the user's yes.

---

## Task-driven flow example: finance trading program

Input: `skills-gate task "build a finance trading program"`.

1. Parse needs: trading, finance, crypto, market data, backtesting, risk, maybe Python/TypeScript.
2. Search bank: `skills-gate search "finance trading crypto market data backtest"`. Result: none in bank (as in the reported case).
3. Search market catalog: `skills-gate search ... --market`. Result: none relevant (market results were image/video generation).
4. Search live marketplaces: `skills-gate search ... --market --live`. Show top 3 with install counts. If none relevant, report "no trading-specific skills found" and list adjacent skills (deep-research, find-docs, codebase, etc.).
5. Ask the user: install adjacent skills, or proceed with none. If yes, `skills-gate add <refs>` with scan and trust flow.
6. Deploy approved skills to the agents active in the project: `skills-gate on --global` or `provision`.
7. Write manifest: `skills-gate project save`.
8. Sync peers: `skills-gate push`.
9. Report what landed, one line each, with token cost.

Later, the nightly tidy sees which of those skills were actually loaded. Unused ones go cold after 30 days. Used ones stay. The user can pin any of them.

---

## Context pruning strategy

- Token estimate per skill: count SKILL.md bytes / 4 as a rough token count. Store it.
- Budget: default 2000 tokens of loaded skills per project, configurable.
- `suggest` stops at the budget and reports how many candidates were skipped for budget.
- `on` and `provision` warn when a load would exceed the budget.
- Tidy ranks cold candidates by (days since last use) / (token cost), so heavy, unused skills go first.
- Pinned and referenced skills never go cold, even over budget; the budget warning names them.
- Per-peer usage aggregation already prevents cold storage when any peer uses the skill.

---

## Multi-machine and backup

- Keep peer sync via a private Git remote.
- Add `skills-gate backup` as an alias flow: set remote, push, verify.
- Skill-aware merge already handles rename vs edit; keep it.
- Conflicts never block; local stays; `conflicts/` holds the other side.
- Snapshot restore: keep versioned copies in `cold/` with origin notes; add `restore <skill> <version>`.
- Secrets and files over 10 MB stay home (already).

---

## Security and trust

- Keep the install scan and the egress policy.
- Keep quarantine and the local reviewer.
- Keep rollback.
- Add an activity log entry for every install, remove, update, sync, deploy, undeploy, and quarantine action.
- Add `logs export` to bundle recent activity and logs into a zip for issue reports.
- The gate skill states the rule: a skill never calls out without approval; agents may never pass `--allow-net` or `--allow-risky`.

---

## Settings and configuration

- Keep `config.json` as the source of truth, with keys you leave out keeping defaults.
- Add a `config` command group: `config show`, `config set <key> <value>`, `config reset <key>`, so agents do not edit JSON by hand.
- Add custom agents and path overrides to config.
- Add workspaces and linked roots to config.
- Theme, text size, language, tray behavior, proxy: not applicable without a GUI; store them anyway for future use, but do not require them.

---

## Migration from skills-manager

- Add `skills-gate import skills-manager [--path <dir>]` that reads `~/.skills-manager/skills-manager.db` and `~/.skills-manager/skills/`.
- Import skills into the bank (reuse `adopt` logic).
- Import presets as skills-gate presets.
- Import tags.
- Import deployments as skills-gate deployments.
- Import custom agents.
- Do not delete or modify the skills-manager data. Import is additive and idempotent.
- `skills-gate adopt <its library folder>` already banks its library; the import command adds metadata.

---

## Phased roadmap

Phase 0: this vision document. No code.

Phase 1: parity data model.
- Add tags, workspaces, deployments, custom agents, activity log tables.
- Add `tag` command group.
- Add `workspace` command group (global, project, linked).
- Add `agents` custom add with arbitrary dirs and path overrides.
- Add `preview` command.
- Add `logs export`.

Phase 2: task-driven orchestration.
- Add `task` command and MCP tool.
- Add `provision` command.
- Add `context` command and budget enforcement in `suggest` and `on`.

Phase 3: pruning intelligence.
- Token estimates and budget-aware pruning.
- Auto-pin by usage threshold.
- Task-cold rule (30 days).
- Per-project keep-over-global-cold.

Phase 4: sync and migration polish.
- `import skills-manager`.
- `backup` flow.
- `restore <skill> <version>`.
- CLI self-update (optional, last).

Phase 5: optional web view.
- A read-only web UI over the same CLI/MCP, only if needed. Not required for the core.

---

## Non-goals

- No required GUI. A web view is optional and ships last.
- No cloud service. Sync uses your own Git remote.
- No telemetry leaving the machine. Activity logs stay local unless you export them.
- No auto-apply of updates without the local reviewer or your approval.
- No agent writing directly into an agent folder. All changes go through skills-gate.

---

## Success metrics

- Session listing cost stays under 500 tokens for the gate, regardless of bank size.
- `task` completes a finance-style request end to end, including the "no skills found" case, without manual steps.
- Pruning removes at least 30 percent of cold skills within 90 days on the reference machine, with zero false removals of referenced skills.
- Peer sync stays conflict-free for the common rename-vs-edit case.
- Every write command has `--dry-run` and `--json`, and every refusal names the path in the way.
- Migration from skills-manager imports presets, tags, and deployments without data loss.

---

## Open questions

- Should the web view ship at all, or stay CLI-only forever?
- Should `task` auto-deploy to all agents in the project, or only the one the agent is running in?
- Should token estimates use a real tokenizer when available, or stay byte-based?
- Should in-app updates be replaced by `git pull` of the skills-gate repo itself?

These stay open until a proposal answers them. Proposals must reference the section they change.
