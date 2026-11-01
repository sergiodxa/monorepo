/**
 * Runs `sdxc-merge-patch` through `invoke()` against files in a temporary directory and piped
 * stdin, so each command's stdout, stderr and exit code are checked as a caller sees them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** The temporary directory every run uses as its working directory. */
let cwd = "";

beforeAll(async () => {
	cwd = await mkdtemp(join(tmpdir(), "sdxc-merge-patch-"));
	await writeFile(join(cwd, "article.json"), '{"title":"Goodbye!","tags":["a","b"],"draft":true}');
	await writeFile(join(cwd, "patch.json"), '{"title":"Hello!","tags":["a"],"draft":null}');
	await writeFile(join(cwd, "edited.json"), '{"title":"Hello!","tags":["a","b"]}');
	await writeFile(join(cwd, "nulled.json"), '{"title":null}');
	await writeFile(join(cwd, "broken.json"), "{title:");
});

afterAll(async () => {
	await rm(cwd, { recursive: true, force: true });
});

describe("apply", () => {
	test("prints the merged document, indented", async () => {
		let run = await invoke(cli, ["apply", "patch.json", "article.json"], { cwd });
		expect(run).toMatchObject({ code: 0, stderr: "" });
		expect(run.stdout).toBe('{\n  "title": "Hello!",\n  "tags": [\n    "a"\n  ]\n}\n');
	});

	test("reads the document from stdin when it is left out", async () => {
		let run = await invoke(cli, ["apply", "patch.json", "--compact"], {
			cwd,
			stdin: '{"title":"Goodbye!","draft":true}',
		});
		expect(run).toMatchObject({ code: 0, stdout: '{"title":"Hello!","tags":["a"]}\n' });
	});

	test("reads the patch from stdin when it is -", async () => {
		let run = await invoke(cli, ["apply", "-", "article.json", "--compact"], {
			cwd,
			stdin: '{"draft":null}',
		});
		expect(run).toMatchObject({ code: 0, stdout: '{"title":"Goodbye!","tags":["a","b"]}\n' });
	});

	test("refuses to read both inputs from stdin", async () => {
		let run = await invoke(cli, ["apply", "-"], { cwd, stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Only one of patch and document can come from stdin");
	});

	test("exits 2 on a patch that is not JSON", async () => {
		let run = await invoke(cli, ["apply", "broken.json", "article.json"], { cwd });
		expect(run).toMatchObject({ code: 2, stdout: "" });
		expect(run.stderr).toContain("broken.json is not JSON");
	});

	test("exits 2 on a missing file", async () => {
		let run = await invoke(cli, ["apply", "patch.json", "missing.json"], { cwd });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read missing.json");
	});

	test("exits 2 without piped input instead of waiting on a terminal", async () => {
		let run = await invoke(cli, ["apply", "patch.json"], { cwd });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("No input");
	});
});

describe("diff", () => {
	test("prints the merge patch between two documents", async () => {
		let run = await invoke(cli, ["diff", "article.json", "edited.json", "--compact"], { cwd });
		expect(run).toMatchObject({
			code: 0,
			stdout: '{"draft":null,"title":"Hello!"}\n',
			stderr: "",
		});
	});

	test("reads the first document from stdin when it is -", async () => {
		let run = await invoke(cli, ["diff", "-", "edited.json", "--compact"], {
			cwd,
			stdin: '{"title":"Hello!","tags":["a","b"]}',
		});
		expect(run).toMatchObject({ code: 0, stdout: "{}\n" });
	});

	test("exits 1 when the target sets a member to null", async () => {
		let run = await invoke(cli, ["diff", "article.json", "nulled.json"], { cwd });
		expect(run).toMatchObject({ code: 1, stdout: "" });
		expect(run.stderr).toContain("cannot set /title to null");
	});

	test("refuses to read both documents from stdin", async () => {
		let run = await invoke(cli, ["diff", "-", "-"], { cwd, stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Only one of before and after can come from stdin");
	});

	test("exits 2 on a document that is not JSON", async () => {
		let run = await invoke(cli, ["diff", "article.json", "broken.json"], { cwd });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("broken.json is not JSON");
	});
});
