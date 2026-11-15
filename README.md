# skills-gate

One skill in front of all of them.

Coding agents load every skill folder they can see. With a hundred skills installed, each session starts by paying
for a hundred descriptions, and the agent picks from a menu too long to read. skills-gate moves every skill into a
bank and leaves one skill in view: the gate. The gate carries a short registry, one lane per category with a line per
skill, and pulls in a skill's full playbook only when a task calls for it. A daily pass switches off what stopped
being used.

No GUI, no daemon, no dependencies: one Python 3.9+ file and a SQLite database.

Inspired by [xingkongliang/skills-manager](https://github.com/xingkongliang/skills-manager), which syncs a central
library into 50+ agents through a desktop app. skills-gate takes the library idea and inverts the default: nothing is
deployed unless a task needs it, and unused skills prune themselves.

## Install

```bash
git clone https://github.com/T-Crypt/skills-gate
ln -s "$PWD/skills-gate/bin/skills-gate" ~/.local/bin/skills-gate
skills-gate init               # creates ~/.skills-gate and puts the gate skill in every harness folder found
skills-gate gate --dry-run     # what would move behind the gate
skills-gate gate               # move it (undo with: skills-gate ungate)
skills-gate timer              # daily tidy (systemd user timer, or prints a cron line)
```

`init` looks for these global skill folders and uses the ones that exist: `~/.claude/skills` (Claude Code),
`~/.agents/skills` (Pi, OpenCode, Codex and other agents that read the shared folder), `~/.pi/agent/skills`,
`~/.config/opencode/skills`, `~/.codex/skills`. Edit `~/.skills-gate/config.json` to add or drop one.

## How an agent uses it

The gate skill tells the agent all of this; you rarely type it yourself.

```bash
skills-gate lane                 # lanes and their size
skills-gate lane media           # one line per skill in a lane
skills-gate search "pdf forms"   # search the bank
skills-gate use pdf-tools        # print the playbook into the session, now (recorded as a use)
skills-gate on pdf-tools         # keep it loaded for this project (links it into .agents/skills and .claude/skills)
skills-gate off pdf-tools
skills-gate search "pdf" --market            # look on GitHub for SKILL.md files
skills-gate add owner/repo/skills/pdf-tools  # install into the bank (the gate says: only on the user's yes)
```

`use` is the light path: the playbook enters the conversation once and nothing changes on disk. `on` is for a
project that keeps needing a skill; it links the skill into the project, and `tidy` takes it out after
`prune_days` (14) without use.

## Commands

| Command | What it does |
|---|---|
| `init` | Create the home, config and database; link the gate into every harness folder |
| `add <folder\|git-url\|owner/repo[/path][@ref]>` | Install skills into the bank. `--link` keeps a local folder as a link, so edits at the source flow through. `--only a b` picks from a multi-skill repo. `--lane` sets the lane |
| `adopt <folders...>` | Import every skill already sitting in existing skill folders |
| `gate [--dry-run]` | Move every skill out of the harness folders into the bank, keep the always-on ones, back up what moved |
| `ungate` | Put back everything `gate` moved |
| `lane [name]` / `set-lane <lane> <skills...>` | Read or change the lanes |
| `search <words> [--market]` | Search the bank, or GitHub |
| `use <skill>` | Print a skill's playbook (on demand) |
| `on` / `off <skills...> [--global] [--project DIR]` | Live toggle: link into or out of a project or every harness |
| `pin` / `unpin <skills...>` | Exempt from pruning |
| `remove <skills...>` | Move to cold storage (restore with `add`) |
| `tidy [--fix] [--dry-run]` | The daily pass, below |
| `reindex [--relane]` | Re-read every skill's front matter |
| `status`, `doctor`, `show <skill>`, `timer` | Inspect and maintain |

## The daily tidy

1. **Usage.** Reads `skills-gate use` and `on` events, and Skill tool calls in Claude Code transcripts (tool name
   and input only, never message text).
2. **Stale toggles off.** A skill switched on but unused for `prune_days` is unlinked.
3. **Cold storage.** A bank skill unused for `cold_days` (120) and not pinned moves to `~/.skills-gate/cold/`.
4. **Leaks.** A skill dropped straight into a harness folder, bypassing the gate, is reported, and with `--fix`
   moved into the bank.
5. **Registry.** The gate skill and the lane files are rebuilt, sizes and hashes refreshed, broken links reported.
6. **Cost.** Prints the tokens each harness spends listing skills in every session, the gate's size and the bank's
   disk use.

## Layout

```
~/.skills-gate/
  config.json        harness folders, always-on skills, prune and cold days
  gate.db            registry: skills, lanes, usage, toggles, events
  bank/<skill>/      every skill (copies, or links to their source)
  cold/<skill>/      pruned or removed skills
  gated/             what `gate` moved, for `ungate`
  lanes/<lane>.md    one line per skill, read by `skills-gate lane`
  skill/skills-gate/ the gate skill, linked into every harness folder
```

Set `SKILLS_GATE_HOME` to keep it somewhere else.

## Config

```json
{
  "always_on": ["find-docs"],
  "prune_days": 14,
  "cold_days": 120,
  "harness_dirs": {"claude": "~/.claude/skills", "agents": "~/.agents/skills"},
  "project_dirs": [".agents/skills", ".claude/skills"]
}
```

Keys you leave out keep their defaults. Set a harness folder to `""` to leave it alone.

## Tests

```bash
python3 -m unittest discover -s tests
```

The tests run every command in a throwaway home with fake harness folders.

## License

MIT
