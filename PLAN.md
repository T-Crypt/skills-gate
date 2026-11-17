# skills-gate plan: phases as slices

This file breaks the VISION.md roadmap into small, verifiable slices. Each slice ends in a check you can run before the next one starts. No code lands until a slice is approved. Phase 0 (VISION.md) is done.

Rules for every slice:
- One slice, one check. If the check fails, stop and report. Do not start the next slice.
- Keep the diff small. Prefer editing `bin/skills-gate` over adding files.
- Every new write command gets `--dry-run` and `--json`.
- Every refusal names the path in the way and offers adopt or move-aside.
- Standard library only. No new runtime dependencies.

---

## Phase 1: parity data model

Goal: match skills-manager's data model (tags, workspaces, deployments, custom agents, activity log) without a GUI.

### Slice 1.1: schema migration runner

- Goal: a single, idempotent migration step that creates new tables on existing homes.
- Touches: `bin/skills-gate`, `init`, a new `migrate` internal call run by every command that opens the DB.
- Data: new tables `tags`, `skill_tags`, `workspaces`, `deployments`, `custom_agents`, `activity_log`, `context_usage`. Keep existing tables.
- Check: run `skills-gate status` on a home created by 0.5.0; all new tables exist; old data intact; running twice changes nothing.
- Risk: low. Migration must be additive only.

### Slice 1.2: tags

- Goal: first-class tags with filter support.
- Touches: `tag` command group (`add`, `remove`, `set`, `rename`, `delete`, `list`), `skills list` filters (`--tag`, `--untagged`, `--no-preset`), search scoring boost for tag match.
- Data: `tags`, `skill_tags`.
- Check: tag a skill, list by tag, list untagged, rename a tag, delete with `--dry-run` then `--yes`; JSON output matches skills-manager style.
- Risk: low.

### Slice 1.3: custom agents and path overrides

- Goal: add agents with arbitrary skills dirs, override built-in paths.
- Touches: `agents add <name> --dir <path> [--project <path>]`, `agents path <name> <key> <value>`, config persistence of overrides.
- Data: `custom_agents` table plus `config.harness_dirs` overrides.
- Check: add a custom agent, gate it, `agents` lists it, override a built-in path, `doctor` reports the effective path.
- Risk: medium. Path handling on Windows and symlinked homes.

### Slice 1.4: workspaces registry

- Goal: register global, project, and linked skills roots.
- Touches: `workspace add <path> [--kind global|project|linked] [--agent <key>]`, `workspace list`, `workspace remove`, `workspace show`.
- Data: `workspaces` table.
- Check: register a linked root, list it, remove it; auto-register each agent's global dir as a global workspace on `init`.
- Risk: low.

### Slice 1.5: deployments and live state

- Goal: track per-agent live deployment state, including unmanaged skills.
- Touches: `deploy`/`undeploy` (rename from `on`/`off --global` or add aliases), `skills status`, global workspace view listing managed and unmanaged skills.
- Data: `deployments` table with mode (symlink/copy) and state (live/stale/missing).
- Check: deploy a skill to one agent, `status` shows live; remove the file by hand, `status` shows missing; undeploy clears the row.
- Risk: medium. State checks must not touch files.

### Slice 1.6: preview and source inspection

- Goal: read SKILL.md and README.md, inspect source metadata, compare with upstream.
- Touches: `preview <skill>` (prints both files), `show` gains source metadata block, `diff` already exists.
- Data: none new.
- Check: preview a bank skill; show its source repo, path, commit, tree id; diff against upstream on a changed skill.
- Risk: low.

### Slice 1.8: project skill commit opt-in

- Goal: project skills never commit by default; commit only on explicit request.
- Touches: `on`/`project save` write the exclude entry to `.git/info/exclude`; `--commit` flag marks a skill as committed; manifest records `committed: true`; `project sync` handles both cases; `doctor` checks consistency.
- Data: `committed` field in manifest entries.
- Check: embed a skill in a test repo, verify `.git/info/exclude` contains it and `git status` is clean; run with `--commit`, verify it is tracked; `doctor` reports mismatch when a tracked skill is not marked committed.
- Risk: medium. Must not edit `.gitignore`.

### Slice 1.7: activity log and export

- Goal: record every install, remove, update, sync, deploy, undeploy, quarantine action; export to zip.
- Touches: write `activity_log` on each action, `logs export [--days N] [--out path]`.
- Data: `activity_log` table.
- Check: perform one of each action, export a zip, unzip and verify one line per action with timestamp and result.
- Risk: low. Zip uses stdlib `zipfile`.

---

## Phase 2: task-driven orchestration

Goal: an agent can take a task and provision skills end to end.

### Slice 2.1: token estimates and context command

- Goal: estimate token cost per skill and report session/project context usage.
- Touches: `reindex` stores `token_estimate` (bytes / 4), `context` command printing loaded cost, budget, and pinned skills.
- Data: `context_usage` table, `token_estimate` column on skills.
- Check: `context` on a project with two skills loaded reports a number; `reindex` updates estimates after an edit.
- Risk: low.

### Slice 2.2: budget enforcement

- Goal: respect `context_budget` in suggest and on.
- Touches: config key `context_budget` (default 2000), `suggest` stops at budget and reports skipped count, `on` warns on overflow.
- Data: none new.
- Check: set a tiny budget, run `suggest` on a broad prompt, verify it stops early and names the skipped count.
- Risk: low.

### Slice 2.3: provision command

- Goal: deploy a set of skills to agents and/or a project in one call.
- Touches: `provision <skills|preset|lane> [--agents ...] [--project] [--dry-run]`.
- Data: uses deployments table.
- Check: provision a preset to two agents, verify both folders have the skills, `--dry-run` changes nothing.
- Risk: medium. Must not overwrite unmanaged files (TARGET_CONFLICT pattern).

### Slice 2.4: task command

- Goal: end-to-end provisioning for a task string.
- Touches: `task "<task>"` (and MCP `skills_task`): parse needs, search bank, search market, show short list, ask approval, install, deploy, write manifest, sync peers, log.
- Data: `installed_by_task`, `last_task` on skills.
- Check: run `task "build a finance trading program"` on a test home; verify it reports "no trading skills found" and lists adjacent skills; run with `--yes` on a known skill and verify deploy + manifest + log.
- Risk: high. This is the headline feature. Ship behind `--dry-run` first, then interactive, then `--yes`.

### Slice 2.5: MCP coverage

- Goal: expose new verbs over MCP.
- Touches: add `skills_task`, `skills_provision`, `skills_context`, `skills_preview`, `skills_workspace_*` to MCP server.
- Data: none new.
- Check: call each new tool via MCP smoke test; verify JSON shapes.
- Risk: low.

---

## Phase 3: pruning intelligence

Goal: pruning depends on usage, token cost, and task origin.

### Slice 3.1: token-aware cold ranking

- Goal: tidy picks cold candidates by days-unused divided by token cost.
- Touches: `tidy` cold-selection query.
- Data: uses `token_estimate`.
- Check: two unused skills, one heavy; verify the heavy one goes cold first in a dry-run.
- Risk: low.

### Slice 3.2: auto-pin by usage

- Goal: pin a skill automatically after N uses across M projects within a window.
- Touches: `harvest`/`tidy` pin logic, config `auto_pin_threshold` (default 5 uses / 2 projects / 30 days).
- Data: `pinned` flag already exists.
- Check: simulate usage counts, run tidy, verify pin applied and reported.
- Risk: medium. Must not pin a skill the user explicitly unpinned.

### Slice 3.3: task-cold rule

- Goal: a task-installed skill unused for 30 days goes cold automatically.
- Touches: `tidy` rule, config `task_cold_days` (default 30), note in cold storage.
- Data: uses `installed_by_task`.
- Check: set a task-installed skill's last use to 31 days ago, run tidy, verify it goes cold with the task note.
- Risk: low.

### Slice 3.4: per-project keep over global cold

- Goal: a skill cold globally stays live in a project that still uses it.
- Touches: tidy cold logic checks project manifests and project-level usage.
- Data: reads `.skills-gate.json`.
- Check: one project still lists the skill, run tidy, verify global cold but project link intact.
- Risk: medium. Cross-check project_dirs.

### Slice 3.5: budget-aware suggestion reporting

- Goal: suggest reports how many candidates were skipped for budget.
- Touches: `suggest` output.
- Data: none new.
- Check: JSON output includes `skipped_for_budget`.
- Risk: low.

---

## Phase 4: sync and migration

Goal: migrate from skills-manager and polish backup/restore.

### Slice 4.1: import skills-manager

- Goal: read skills-manager's DB and import skills, presets, tags, deployments, custom agents.
- Touches: `import skills-manager [--path <dir>]`.
- Data: reads external DB, writes into skills-gate tables; never modifies source.
- Check: run against the local skills-manager DB, verify counts match, re-run is idempotent, source DB unchanged.
- Risk: medium. External schema must be read defensively.

### Slice 4.2: backup and restore

- Goal: `backup` flow (set remote, push, verify) and `restore <skill> <version>`.
- Touches: `backup`, `restore`.
- Data: versioned copies in `cold/` with origin notes.
- Check: push to a bare repo, restore a prior version, verify content hash.
- Risk: low.

### Slice 4.3: CLI self-update (optional)

- Goal: `skills-gate self-update` pulls the repo and re-links the binary.
- Touches: `self-update`.
- Data: none.
- Check: run on a clean clone, verify version bump reported.
- Risk: low. Keep optional and last.

---

## Phase 5: optional web view

Deferred. Only if needed. A read-only view over the same CLI/MCP. Not required for the core. No slices until Phases 1-4 are done.

---

## Dependency order

1.1 -> 1.2, 1.3, 1.4 (schema first)
1.4 -> 1.5 (workspaces before deployments)
1.1 -> 1.6, 1.7
2.1 -> 2.2 -> 2.4
1.5 -> 2.3 -> 2.4
2.4 -> 3.3
3.1 -> 3.5
4.1 depends on 1.2, 1.3, 1.4, 1.5
4.2 depends on 1.1

## Slice count

Phase 1: 8 slices. Phase 2: 5. Phase 3: 5. Phase 4: 3. Phase 5: deferred.

Total: 21 slices. Each slice is one PR-sized change with one check.
