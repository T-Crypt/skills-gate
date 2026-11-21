// The skills-gate drop-in, in a real HADAL on a temporary data folder, with a scripted model and a fake CLI.
// Run: node --test harness/hadal/skills-gate.test.ts   (HADAL_SRC: a HADAL checkout, default ~/projects/hadal-live)
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const HADAL = process.env.HADAL_SRC ?? join(homedir(), "projects", "hadal-live");
// HADAL's helpers first: they point HADAL at a temporary folder before it loads.
const { cleanUp, lastText, newSession, openApp, owner, root, say, scriptedModel, work, modelTexts } = await import(
    join(HADAL, "test", "helpers.ts")
);
const { fauxAssistantMessage, fauxText, fauxToolCall } = await import(
    join(HADAL, "node_modules", "@earendil-works", "pi-ai", "dist", "providers", "faux.js")
);

const bin = mkdtempSync(join(tmpdir(), "sg-hadal-"));
const log = join(bin, "calls.log");
const fake = join(bin, "skills-gate");

writeFileSync(
    fake,
    `#!/bin/sh
echo "$*" >> "${log}"
if [ "$1" = suggest ]; then
  case "$(cat)" in *video*) echo "skills-gate: NOTE video-cut [media]";; esac
fi
`,
);
chmodSync(fake, 0o755);
process.env.SKILLS_GATE_BIN = fake;

type Seen = { role: string; content: unknown }[];
const requests: Seen[] = [];
const skillFile = join(work, "bank", "video-cut", "SKILL.md");

const model = scriptedModel((context: { messages: Seen }) => {
    if (context.messages[0]?.role === "system") {
        requests.push(structuredClone(context.messages)); // the session's requests, not the one that names it
    }
    const { role, text } = lastText(context as never);

    if (role === "user" && text.includes("read the skill")) {
        return fauxAssistantMessage([fauxToolCall("read", { path: skillFile })], { stopReason: "toolUse" });
    }

    return fauxAssistantMessage([fauxText("done")]);
});

const calls = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
const text = (messages: Seen) => messages.filter((m) => m.role === "user").map((m) => JSON.stringify(m.content));

after(cleanUp);

test("suggestions reach the model, stay out of the transcript, and each read SKILL.md is counted", async () => {
    mkdirSync(join(work, "bank", "video-cut"), { recursive: true });
    writeFileSync(skillFile, "---\nname: video-cut\ndescription: Cut a video\n---\nCut it.\n");
    const dropIns = join(root, "data", "extensions");

    mkdirSync(dropIns, { recursive: true });
    copyFileSync(join(import.meta.dirname, "skills-gate.ts"), join(dropIns, "skills-gate.ts"));
    const app = await openApp(model);

    try {
        await app.setExtensionEnabled(owner(app), "skills-gate.ts", true);
        const id = await newSession(app);

        await say(app, id, "Please cut a video for me, and read the skill first.");
        // Two requests in that turn (before and after the read): the note is in both, from one suggest call.
        assert.equal(requests.length, 2);
        for (const request of requests) {
            assert.match(text(request).at(-1) ?? "", /NOTE video-cut/);
        }
        assert.ok(!(await modelTexts(app, id)).some((entry: string) => entry.includes("NOTE video-cut")));

        for (let i = 0; i < 40 && !calls().some((c) => c.startsWith("seen ")); i++) {
            await new Promise((r) => setTimeout(r, 50));
        }
        assert.deepEqual(
            calls().filter((c) => c.startsWith("seen ")),
            [`seen ${skillFile} --via hadal`],
        );

        await say(app, id, "Thanks, now write the summary of it.");
        const third = text(requests[2]);

        assert.match(third[0], /NOTE video-cut/); // the first message keeps its note: the prefix does not change
        assert.doesNotMatch(third.at(-1) ?? "", /NOTE/); // nothing matched the new one
        assert.equal(calls().filter((c) => c.startsWith("suggest")).length, 2); // one per person's message
    } finally {
        await app.close();
    }
});
