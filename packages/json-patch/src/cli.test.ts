/**
 * Tests for the `sdxc-json-patch` command line: what `apply`, `diff` and `validate` print on
 * each stream and the exit code they answer for files, piped stdin, a failing operation, an
 * invalid patch and unreadable input, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const ARTICLE = { title: "Draft", tags: ["a"] };

const PATCH = [
	{ op: "test", path: "/title", value: "Draft" },
	{ op: "replace", path: "/title", value: "Hello" },
	{ op: "add", path: "/tags/-", value: "b" },
];

const PATCHED = { title: "Hello", tags: ["a", "b"] };

/** The directory each test runs in, holding the fixture files the tests name. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-json-patch-"));
	let files: Record<string, string> = {
		"article.json": JSON.stringify(ARTICLE),
		"patched.json": JSON.stringify(PATCHED),
		"patch.json": JSON.stringify(PATCH),
		"stale.json": JSON.stringify([
			{ op: "replace", path: "/title", value: "Hello" },
			{ op: "test", path: "/tags/0", value: "z" },
		]),
		"missing-path.json": JSON.stringify([{ op: "remove", path: "/body" }]),
		"invalid.json": JSON.stringify([{ op: "add", path: "/a" }]),
		"not-json.txt": "{ nope",
	};
	await Promise.all(
		Object.entries(files).map(([name, text]) => writeFile(join(FIXTURE.dir, name), text, "utf8")),
	);
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-json-patch` in the fixture directory, with `stdin` piped when given. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin });
}

describe("sdxc-json-patch apply", () => {
	test("prints the patched document, indented", async () => {
		let { code, stdout, stderr } = await run(["apply", "patch.json", "article.json"]);

		expect(code).toBe(0);
		expect(stdout).toBe(`${JSON.stringify(PATCHED, null, 2)}\n`);
		expect(stderr).toBe("");
	});

	test("reads the document from stdin and prints one line with --compact", async () => {
		let { code, stdout } = await run(["apply", "patch.json", "--compact"], JSON.stringify(ARTICLE));

		expect(code).toBe(0);
		expect(stdout).toBe(`${JSON.stringify(PATCHED)}\n`);
	});

	test("reads the patch from stdin when the document is a file", async () => {
		let { code, stdout } = await run(
			["apply", "-", "article.json", "--compact"],
			JSON.stringify(PATCH),
		);

		expect(code).toBe(0);
		expect(stdout).toBe(`${JSON.stringify(PATCHED)}\n`);
	});

	test("exits 1 naming the operation whose test fails", async () => {
		let { code, stdout, stderr } = await run(["apply", "stale.json", "article.json"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^Operation 1: /);
	});

	test("exits 1 naming the operation whose path has nothing to act on", async () => {
		let { code, stderr } = await run(["apply", "missing-path.json", "article.json"]);

		expect(code).toBe(1);
		expect(stderr).toMatch(/^Operation 0: /);
	});

	test("exits 2 for a patch that is not a JSON Patch document", async () => {
		let { code, stdout, stderr } = await run(["apply", "invalid.json", "article.json"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^invalid\.json: Operation 0: /);
	});

	test("exits 2 for a document that is not JSON", async () => {
		let { code, stderr } = await run(["apply", "patch.json", "not-json.txt"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^not-json\.txt is not JSON: /);
	});

	test("exits 2 for a file that does not exist", async () => {
		let { code, stderr } = await run(["apply", "patch.json", "nowhere.json"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^Cannot read nowhere\.json: /);
	});

	test("exits 2 when both the patch and the document would come from stdin", async () => {
		let { code, stderr } = await run(["apply", "-"], "[]");

		expect(code).toBe(2);
		expect(stderr).toContain("Read the patch or the document from stdin, not both");
	});
});

describe("sdxc-json-patch diff", () => {
	test("prints the patch between two files", async () => {
		let { code, stdout, stderr } = await run(["diff", "article.json", "patched.json", "--compact"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual([
			{ op: "replace", path: "/title", value: "Hello" },
			{ op: "add", path: "/tags/1", value: "b" },
		]);
		expect(stdout.endsWith("]\n")).toBe(true);
		expect(stderr).toBe("");
	});

	test("prints the patch whose apply turns before into after", async () => {
		let patch = await run(["diff", "article.json", "-"], JSON.stringify(PATCHED));
		await writeFile(join(FIXTURE.dir, "computed.json"), patch.stdout, "utf8");

		let applied = await run(["apply", "computed.json", "article.json", "--compact"]);

		expect(applied.stdout).toBe(`${JSON.stringify(PATCHED)}\n`);
	});

	test("prints [] for equal documents", async () => {
		let { code, stdout } = await run(["diff", "article.json", "article.json"]);

		expect(code).toBe(0);
		expect(stdout).toBe("[]\n");
	});

	test("exits 2 when both documents would come from stdin", async () => {
		let { code } = await run(["diff", "-", "-"], "{}");

		expect(code).toBe(2);
	});

	test("exits 2 for a document that is not JSON", async () => {
		let { code, stderr } = await run(["diff", "article.json", "not-json.txt"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^not-json\.txt is not JSON: /);
	});
});

describe("sdxc-json-patch validate", () => {
	test("counts the operations of a valid patch", async () => {
		let { code, stdout, stderr } = await run(["validate", "patch.json"]);

		expect(code).toBe(0);
		expect(stdout).toBe("patch.json: 3 operations\n");
		expect(stderr).toBe("");
	});

	test("reads stdin and reports as JSON", async () => {
		let { code, stdout } = await run(["validate", "--json"], JSON.stringify(PATCH));

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual({ valid: true, operations: 3 });
	});

	test("exits 1 naming the invalid operation", async () => {
		let { code, stdout, stderr } = await run(["validate", "invalid.json"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toMatch(/^invalid\.json: Operation 0: /);
	});

	test("exits 1 with the problem as JSON", async () => {
		let { code, stdout, stderr } = await run(["validate", "invalid.json", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toMatchObject({ valid: false, index: 0 });
		expect(stderr).toBe("");
	});

	test("exits 1 for text that is not JSON, with no operation index", async () => {
		let { code, stdout } = await run(["validate", "not-json.txt", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toMatchObject({ valid: false, index: null });
	});

	test("exits 2 when nothing is piped and no file is named", async () => {
		let { code, stderr } = await run(["validate"]);

		expect(code).toBe(2);
		expect(stderr).toMatch(/^No input/);
	});
});
