"""End-to-end tests for skills-gate in a throwaway home. Run: python3 -m unittest discover -s tests"""
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

CLI = Path(__file__).resolve().parents[1] / "bin" / "skills-gate"


def skill(root: Path, name: str, desc: str, body: str = "Do the thing.\n") -> Path:
    d = root / name
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(f"---\nname: {name}\ndescription: \"{desc}\"\n---\n\n# {name}\n\n{body}")
    return d


class GateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="sg-test-"))
        self.home = self.tmp / "home"
        self.claude = self.home / ".claude" / "skills"
        self.agents = self.home / ".agents" / "skills"
        self.claude.mkdir(parents=True)
        self.agents.mkdir(parents=True)
        self.src = self.tmp / "src"
        skill(self.claude, "video-cut", "Cut and caption a video edit")
        skill(self.claude, "keep-me", "Always needed")
        skill(self.agents, "code-review", "Review a diff for bugs")
        linked = skill(self.src, "lab-ops", "Run homelab deploys")
        (self.agents / "lab-ops").symlink_to(linked)
        self.project = self.tmp / "proj"
        self.project.mkdir()
        subprocess.run(["git", "init", "-q", str(self.project)], check=True)
        self.env = dict(os.environ, HOME=str(self.home), SKILLS_GATE_HOME=str(self.home / ".skills-gate"))
        self.sg("init")
        cfg = json.loads((self.home / ".skills-gate" / "config.json").read_text())
        cfg["always_on"] = ["keep-me"]
        cfg["usage_sources"] = {"claude": str(self.home / ".claude" / "projects")}
        (self.home / ".skills-gate" / "config.json").write_text(json.dumps(cfg))

    def sg(self, *args, cwd=None, ok=True):
        r = subprocess.run([sys.executable, str(CLI), *args], env=self.env, cwd=cwd or self.tmp,
                           capture_output=True, text=True)
        if ok and r.returncode != 0:
            self.fail(f"skills-gate {' '.join(args)} failed:\n{r.stdout}\n{r.stderr}")
        return r

    def listing(self, d: Path):
        return sorted(p.name for p in d.iterdir() if not p.name.startswith("."))

    def test_gate_hides_everything_but_gate_and_always_on(self):
        self.assertIn("would gate 3", self.sg("gate", "--dry-run").stdout)
        self.sg("gate")
        self.assertEqual(self.listing(self.claude), ["keep-me", "skills-gate"])
        self.assertEqual(self.listing(self.agents), ["keep-me", "skills-gate"])
        gate = (self.claude / "skills-gate" / "SKILL.md").read_text()
        self.assertIn("| media |", gate)
        self.assertIn("| core |", gate)
        # a symlinked source stays a link in the bank, so edits at the source still flow
        self.assertTrue((self.home / ".skills-gate" / "bank" / "lab-ops").is_symlink())

    def test_ungate_restores(self):
        self.sg("gate")
        self.sg("ungate")
        self.assertIn("video-cut", self.listing(self.claude))
        self.assertTrue((self.agents / "lab-ops").is_symlink())

    def test_use_prints_playbook_and_counts(self):
        self.sg("gate")
        out = self.sg("use", "video-cut").stdout
        self.assertIn("Do the thing.", out)
        self.assertIn('"uses": 1', self.sg("show", "video-cut", "--json").stdout)

    def test_on_off_project_and_tidy_prunes_stale(self):
        self.sg("gate")
        self.sg("on", "code-review", cwd=self.project)
        link = self.project / ".agents" / "skills" / "code-review"
        self.assertTrue(link.is_symlink())
        self.assertTrue((self.project / ".claude" / "skills" / "code-review").is_symlink())
        # age the toggle and the last use past prune_days
        import sqlite3
        db = sqlite3.connect(self.home / ".skills-gate" / "gate.db")
        old = int(time.time()) - 30 * 86400
        db.execute("update toggles set on_at=?", (old,))
        db.execute("update skills set last_used=? where name='code-review'", (old,))
        db.commit()
        db.close()
        self.assertIn("[stale] code-review", self.sg("tidy").stdout)
        self.assertFalse(link.exists() or link.is_symlink())

    def test_pinned_is_never_pruned(self):
        self.sg("gate")
        self.sg("on", "code-review", cwd=self.project)
        self.sg("pin", "code-review")
        import sqlite3
        db = sqlite3.connect(self.home / ".skills-gate" / "gate.db")
        db.execute("update toggles set on_at=0")
        db.execute("update skills set last_used=0, added_at=0")
        db.commit()
        db.close()
        out = self.sg("tidy").stdout
        self.assertNotIn("code-review", out.split("usage:")[1].split("always-loaded")[0])
        self.assertTrue((self.project / ".agents" / "skills" / "code-review").is_symlink())

    def test_tidy_cools_long_unused_and_fixes_leaks(self):
        self.sg("gate")
        import sqlite3
        db = sqlite3.connect(self.home / ".skills-gate" / "gate.db")
        db.execute("update skills set added_at=0 where name='video-cut'")
        db.commit()
        db.close()
        skill(self.claude, "sneaky", "Installed by hand, bypassing the gate")
        out = self.sg("tidy", "--fix").stdout
        self.assertIn("[cold]  video-cut", out)
        self.assertIn("[leak]", out)
        self.assertNotIn("sneaky", self.listing(self.claude))
        self.assertTrue((self.home / ".skills-gate" / "cold" / "video-cut" / "SKILL.md").is_file())

    def test_usage_harvest_from_claude_transcript(self):
        self.sg("gate")
        proj = self.home / ".claude" / "projects" / "x"
        proj.mkdir(parents=True)
        ts = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time() + 5))
        (proj / "s.jsonl").write_text(json.dumps({"timestamp": ts, "message": {"content": [
            {"type": "tool_use", "name": "Skill", "input": {"skill": "code-review"}}]}}) + "\n")
        self.assertIn("1 new Skill call", self.sg("tidy").stdout)

    def test_search_and_lanes(self):
        self.sg("gate")
        self.assertIn("video-cut", self.sg("search", "caption video").stdout)
        self.assertIn("video-cut", self.sg("lane", "media").stdout)
        self.sg("set-lane", "lab", "lab-ops")
        self.assertIn("lab-ops", self.sg("lane", "lab").stdout)

    def test_add_local_and_doctor(self):
        skill(self.tmp / "new", "pdf-tools", "Fill and split PDF files")
        self.sg("add", str(self.tmp / "new"))
        self.assertIn("pdf-tools", self.sg("lane", "docs").stdout)
        self.sg("gate")
        self.assertIn("all good", self.sg("doctor").stdout)


if __name__ == "__main__":
    unittest.main()
