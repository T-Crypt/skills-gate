/**
 * skills-gate in HADAL: banked skills that fit a prompt are named next to it, and each skill HADAL reads is counted.
 *
 * Claude Code gets the same two things from a UserPromptSubmit hook and from its session logs. HADAL has neither:
 * its sessions live in its own database, which `skills-gate tidy` cannot read. So this module does both itself.
 *
 * - Suggestions. Before a request, the newest person's message goes to `skills-gate suggest --hook` (about 80 ms,
 *   BM25 over the bank, quiet unless a skill clears the bar). Its note is added to that message for the request
 *   only; the stored transcript does not change. A message keeps the note it got, so earlier turns stay the same
 *   and the provider's prompt cache holds.
 * - Usage. After a `read` of a `.../<skill>/SKILL.md`, `skills-gate seen <path> --via hadal` counts the load, once
 *   per call, also after a restart. Without it, a skill HADAL uses every day looks idle and the nightly tidy turns
 *   it off after 14 days.
 *
 * Both call the `skills-gate` CLI (override with SKILLS_GATE_BIN). If it is missing or slow, nothing happens: a
 * suggestion is never worth a stalled or failed request.
 *
 * Source: skills-gate repo, harness/hadal/skills-gate.ts. Install: copy into ~/.hadal/extensions/, then turn it on
 * in Menu -> Extensions.
 */
import { execFile } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { defineExtension, GenerationTask, hook, ToolTask } from "@earendil-works/pi-durable";

export const pocketApi = 2;

const BIN = process.env.SKILLS_GATE_BIN || "skills-gate";
const SUGGEST_MS = 3000;
const MEMO_MAX = 500;
const SKILL_MD = /[/\\]SKILL\.md$/;

type Host = { cwdOf?: (conversationId: string) => string };
type Part = { type: string; text?: string };
type UserMessage = { role: "user"; content: string | Part[]; timestamp: number };
type Message = { role: string; content?: unknown };

/** The person's words: HADAL adds `[from: Name]` in front and `[sent ...]` at the end of each message. */
export function promptText(message: UserMessage): string {
    const raw =
        typeof message.content === "string"
            ? message.content
            : message.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text ?? "")
                  .join("\n");

    return raw
        .replace(/^\s*\[from: [^\]\n]*\]\s*/, "")
        .replace(/\s*\[sent [^\]\n]*\]\s*$/, "")
        .trim();
}

function run(args: string[], input: string | undefined, timeout: number): Promise<string> {
    return new Promise((done) => {
        const child = execFile(BIN, args, { timeout, maxBuffer: 64 * 1024 }, (error, stdout) =>
            done(error ? "" : String(stdout).trim()),
        );

        child.on("error", () => done(""));
        if (input !== undefined) {
            child.stdin?.on("error", () => undefined);
            child.stdin?.end(input);
        }
    });
}

function localCwd(host: Host, conversationId: string): string | undefined {
    try {
        const cwd = host.cwdOf?.(conversationId);

        return cwd && isAbsolute(cwd) ? cwd : undefined; // a remote session's cwd is a URI: no local project
    } catch {
        return undefined;
    }
}

/** The note each message got, by its text. Earlier messages keep theirs, so the request prefix does not change. */
const notes = new Map<string, string>();

function remember(text: string, note: string) {
    notes.set(text, note);
    if (notes.size > MEMO_MAX) {
        notes.delete(notes.keys().next().value as string);
    }
}

function withNote(message: UserMessage, note: string): UserMessage {
    const parts: Part[] =
        typeof message.content === "string" ? [{ type: "text", text: message.content }] : [...message.content];

    return { ...message, content: [...parts, { type: "text", text: note }] };
}

export default function createSkillsGate(host: Host = {}) {
    const suggest = hook(GenerationTask, {
        beforeRequest: async (request, api) => {
            const messages = request.messages as readonly Message[];
            const last = messages.findLastIndex((message) => message.role === "user");

            if (last < 0) {
                return undefined;
            }

            const newest = promptText(messages[last] as UserMessage);

            if (newest !== "" && !notes.has(newest)) {
                const payload = {
                    prompt: newest,
                    cwd: localCwd(host, String(api.conversationId)),
                    session_id: String(api.conversationId),
                };

                remember(newest, await run(["suggest", "--hook"], JSON.stringify(payload), SUGGEST_MS));
            }

            let changed = false;
            const out = messages.map((message) => {
                if (message.role !== "user") {
                    return message;
                }

                const note = notes.get(promptText(message as UserMessage));

                if (!note) {
                    return message;
                }

                changed = true;

                return withNote(message as UserMessage, note);
            });

            return changed ? ({ messages: out } as never) : undefined;
        },
    });

    const count = hook(ToolTask, {
        afterTool: async (call, result, api, context) => {
            const args = (call.arguments ?? {}) as { path?: unknown; host?: unknown };

            if (call.name !== "read" || typeof args.path !== "string" || args.host !== undefined) {
                return undefined; // a read on another machine is not a load from this bank
            }
            if (!SKILL_MD.test(args.path) || result.isError === true || (result.diagnostics ?? []).length > 0) {
                return undefined;
            }
            if ((await api.memo<number>("skills-gate.seen", context)) !== undefined) {
                return undefined; // counted before a restart
            }

            await api.memo<number>("skills-gate.seen", Date.now(), context);
            const cwd = localCwd(host, String(api.conversationId));
            const path = isAbsolute(args.path) || cwd === undefined ? args.path : resolve(cwd, args.path);

            void run(["seen", path, "--via", "hadal"], undefined, SUGGEST_MS);

            return undefined;
        },
    });

    return defineExtension({ name: "skills-gate", hooks: [suggest, count] });
}
