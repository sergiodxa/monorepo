/**
 * The lock file: reading with line-numbered failures, keeping unknown kinds verbatim, one line
 * changed per update, deterministic order, and the guard against a moved `lock` path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as s from "@sdxc/json-schema";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import type { Config } from "./config.js";
import type { UILockEntry } from "./lock.js";

import { parseConfig } from "./config.js";
import {
	DEFAULT_LOCK,
	UI_LOCK_ENTRY,
	lockJSONSchema,
	parseLock,
	readLock,
	removeUIEntry,
	renderLock,
	setUIEntry,
	uiEntries,
	uiEntry,
	writeLock,
} from "./lock.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

const BUTTON: UILockEntry = {
	kind: "ui",
	name: "button",
	release: "2026.10.14",
	files: { "button.tsx": "sha256-AAAA" },
};

const DIALOG_LINE =
	'{"kind":"ui","name":"dialog","release":"2026.10.14","files":{"dialog.test.tsx":"sha256-BBBB","dialog.tsx":"sha256-CCCC"}}';

/** A line of a kind this CLI does not know, spaced the way another writer might space it. */
const FUTURE_LINE = '{ "kind": "make", "name": "stubs", "extra": [1, 2] }';

/** An empty project, and its configuration with `overrides` applied. */
async function project(overrides: object = {}): Promise<{ root: string; config: Config }> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-lock-"));
	PROJECTS.push(root);
	await writeFile(join(root, "package.json"), "{}");
	let loaded = unwrap(parseConfig(overrides, root, null));
	return { root, config: loaded.config };
}

describe("parseLock", () => {
	test("reads ui entries and keeps other kinds as written", async () => {
		let lock = unwrap(await parseLock("lock.jsonl", `${DIALOG_LINE}\n\n${FUTURE_LINE}\n`));

		expect(uiEntries(lock).map((entry) => entry.name)).toEqual(["dialog"]);
		expect(lock.lines[1]).toEqual({ kind: "make", name: "stubs", text: FUTURE_LINE });
	});

	test("names the line of invalid JSON, an invalid entry, and a repeated entry", async () => {
		let notJSON = await parseLock("lock.jsonl", `${DIALOG_LINE}\n\n{nope\n`);
		let invalid = await parseLock(
			"lock.jsonl",
			'{"kind":"ui","name":"../x","release":"1","files":{}}\n',
		);
		let noKind = await parseLock("lock.jsonl", '{"name":"x"}\n');
		let repeated = await parseLock("lock.jsonl", `${DIALOG_LINE}\n${DIALOG_LINE}\n`);

		expect(notJSON.status === "failure" && notJSON.error.message).toBe(
			"lock.jsonl:3: not valid JSON",
		);
		expect(invalid.status === "failure" && invalid.error.message).toMatch(/^lock\.jsonl:1: name: /);
		expect(noKind.status === "failure" && noKind.error.message).toBe(
			"lock.jsonl:1: every entry needs a string kind and name",
		);
		expect(repeated.status === "failure" && repeated.error.message).toBe(
			"lock.jsonl:2: repeats the ui entry dialog from line 1; keep one",
		);
	});
});

describe("renderLock", () => {
	test("inserts, replaces and removes one line each, keeping the order by kind then name", async () => {
		let lock = unwrap(await parseLock("lock.jsonl", `${DIALOG_LINE}\n${FUTURE_LINE}\n`));

		let added = setUIEntry(lock, BUTTON);
		let replaced = setUIEntry(added, { ...BUTTON, release: "2026.10.20" });
		let removed = removeUIEntry(replaced, "dialog");

		expect(unwrap(renderLock(added))).toBe(
			[
				FUTURE_LINE,
				'{"kind":"ui","name":"button","release":"2026.10.14","files":{"button.tsx":"sha256-AAAA"}}',
				DIALOG_LINE,
				"",
			].join("\n"),
		);
		expect(uiEntry(replaced, "button")?.release).toBe("2026.10.20");
		expect(unwrap(renderLock(removed)).split("\n")).toHaveLength(3);
	});

	test("writes keys in schema order and files sorted, whatever order they were given in", () => {
		let entry = { files: { "z.tsx": "sha256-AA", "a.tsx": "sha256-BB" }, release: "1", name: "a" };
		let lock = setUIEntry({ path: "lock.jsonl", lines: [] }, { kind: "ui", ...entry });

		expect(unwrap(renderLock(lock))).toBe(
			'{"kind":"ui","name":"a","release":"1","files":{"a.tsx":"sha256-BB","z.tsx":"sha256-AA"}}\n',
		);
	});
});

describe("readLock and writeLock", () => {
	test("answers an empty lock for a new project and creates the parent folders on write", async () => {
		let { root, config } = await project();

		let lock = unwrap(await readLock(root, config));
		unwrap(await writeLock(root, setUIEntry(lock, BUTTON)));

		expect(lock).toEqual({ path: DEFAULT_LOCK, lines: [] });
		expect(await readFile(join(root, DEFAULT_LOCK), "utf8")).toContain('"name":"button"');
		expect(uiEntries(unwrap(await readLock(root, config)))).toEqual([BUTTON]);
	});

	test("stops when the configured lock is missing but one exists at the default path", async () => {
		let { root, config } = await project({ lock: "state/sdxc.lock.jsonl" });
		await mkdir(join(root, ".config"));
		await writeFile(join(root, DEFAULT_LOCK), `${DIALOG_LINE}\n`);

		let lock = await readLock(root, config);

		expect(lock.status === "failure" && lock.error.message).toBe(
			`lock is state/sdxc.lock.jsonl, which does not exist, but ${DEFAULT_LOCK} does; move ${DEFAULT_LOCK} to state/sdxc.lock.jsonl or set lock back to it`,
		);
	});
});

describe("lockJSONSchema", () => {
	test("requires kind and name on every line and holds ui lines to the ui entry", () => {
		let schema = unwrap(lockJSONSchema());

		expect(schema.required).toEqual(["kind", "name"]);
		expect(JSON.stringify(schema.anyOf)).toContain('"release"');
		expect(s.parseSafe(UI_LOCK_ENTRY, JSON.parse(DIALOG_LINE)).success).toBe(true);
	});
});
