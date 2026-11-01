/**
 * Tests for the `sdxc-openapi` command line: `check` over a file, stdin and a URL served by
 * MSW, its human and `--json` reports, and the exit codes for a valid document, findings,
 * and input that cannot be read — driven through `invoke()` with both streams captured.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** A minimal valid document, as JSON. */
const VALID_JSON = '{"openapi":"3.1.1","info":{"title":"Books API","version":"1"},"paths":{}}';

/** The same document, as YAML. */
const VALID_YAML = "openapi: 3.1.1\ninfo:\n  title: Books API\n  version: '1'\n";

/** A document whose `info` lacks a title. */
const MISSING_TITLE = '{"openapi":"3.1.1","info":{"version":"1"}}';

/** The `Accept` the last request to the mock server carried. */
let lastAccept: string | null = null;

/** The network the URL tests reach. */
const SERVER = setupServer(
	http.get("https://api.books.com/openapi.json", ({ request }) => {
		lastAccept = request.headers.get("accept");
		return new HttpResponse(VALID_JSON, {
			headers: { "content-type": "application/openapi+json" },
		});
	}),
	http.get("https://api.books.com/broken.json", () => HttpResponse.text(MISSING_TITLE)),
	http.get("https://api.books.com/missing.json", () => new HttpResponse(null, { status: 404 })),
);

/** Directories the tests created, removed after each one. */
const CREATED_DIRS: string[] = [];

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
	SERVER.resetHandlers();
	for (let dir of CREATED_DIRS.splice(0)) await rm(dir, { recursive: true, force: true });
});
afterAll(() => SERVER.close());

/** Writes `text` to a file in a fresh directory, answering the directory and the file's name. */
async function writeDocument(name: string, text: string): Promise<{ cwd: string; name: string }> {
	let cwd = await mkdtemp(join(tmpdir(), "openapi-cli-"));
	CREATED_DIRS.push(cwd);
	await writeFile(join(cwd, name), text, "utf8");
	return { cwd, name };
}

describe("sdxc-openapi check", () => {
	test("a valid JSON file exits 0 and names the document", async () => {
		let { cwd, name } = await writeDocument("openapi.json", VALID_JSON);
		let run = await invoke(cli, ["check", name], { cwd });

		expect(run).toMatchObject({
			code: 0,
			stdout: "Valid OpenAPI 3.1.1 document: Books API 1\n",
			stderr: "",
		});
	});

	test("a valid YAML document on stdin exits 0", async () => {
		let run = await invoke(cli, ["check", "-"], { stdin: VALID_YAML });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Valid OpenAPI 3.1.1 document: Books API 1\n");
	});

	test("an absent argument reads stdin", async () => {
		let run = await invoke(cli, ["check"], { stdin: VALID_JSON });
		expect(run.code).toBe(0);
	});

	test("a finding exits 1 and prints its JSON Pointer", async () => {
		let run = await invoke(cli, ["check"], { stdin: MISSING_TITLE });

		expect(run).toMatchObject({
			code: 1,
			stdout: "/info/title: info must be an object with a string title and version\n",
			stderr: "",
		});
	});

	test("text that is neither JSON nor YAML is a finding at the root", async () => {
		let run = await invoke(cli, ["check"], { stdin: "{" });

		expect(run.code).toBe(1);
		expect(run.stdout).toMatch(/^\(root\): Invalid JSON: /);
	});

	test("--json reports a valid document", async () => {
		let run = await invoke(cli, ["check", "--json"], { stdin: VALID_JSON });

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: true,
			openapi: "3.1.1",
			title: "Books API",
			version: "1",
			findings: [],
		});
	});

	test("--json reports each finding with its pointer", async () => {
		let run = await invoke(cli, ["check", "--json"], {
			stdin: '{"openapi":"3.0.3","info":{"title":"T","version":"1"}}',
		});

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			openapi: null,
			title: null,
			version: null,
			findings: [{ pointer: "/openapi", message: 'Expected openapi 3.1.x, found "3.0.3"' }],
		});
	});

	test("a URL is fetched asking for the OpenAPI media types first", async () => {
		let run = await invoke(cli, ["check", "https://api.books.com/openapi.json"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Valid OpenAPI 3.1.1 document: Books API 1\n");
		expect(lastAccept?.startsWith("application/openapi+json, application/openapi+yaml")).toBe(true);
	});

	test("a URL serving an invalid document exits 1", async () => {
		let run = await invoke(cli, ["check", "https://api.books.com/broken.json"]);

		expect(run.code).toBe(1);
		expect(run.stdout).toContain("/info/title: ");
	});

	test("a URL answering an error status exits 2", async () => {
		let run = await invoke(cli, ["check", "https://api.books.com/missing.json"]);

		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Cannot fetch https://api.books.com/missing.json: HTTP 404");
	});

	test("a missing file exits 2", async () => {
		let { cwd } = await writeDocument("other.json", VALID_JSON);
		let run = await invoke(cli, ["check", "openapi.json"], { cwd });

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read openapi.json");
	});
});
