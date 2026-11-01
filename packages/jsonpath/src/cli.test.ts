/**
 * Tests for the `sdxc-jsonpath` command line: what `query` prints on each stream and the exit
 * code it answers for a file, piped stdin, `--paths`, `--first`, `--fail-empty`, an invalid
 * expression and unreadable input, driven through `invoke()`.
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

const STORE = JSON.stringify({
	store: {
		book: [
			{ title: "Sayings of the Century", price: 8.95 },
			{ title: "Sword of Honour", price: 12.99 },
			{ title: "Moby Dick", price: 8.99 },
		],
	},
});

/** The directory each test runs in, holding `store.json` and `broken.json`. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-jsonpath-"));
	await writeFile(join(FIXTURE.dir, "store.json"), STORE, "utf8");
	await writeFile(join(FIXTURE.dir, "broken.json"), "{ store: ", "utf8");
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-jsonpath` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

describe("sdxc-jsonpath query", () => {
	test("prints the selected values of a file as a JSON array", async () => {
		let { code, stdout, stderr } = await run([
			"query",
			"$.store.book[?@.price < 10].title",
			"store.json",
		]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual(["Sayings of the Century", "Moby Dick"]);
		expect(stdout.endsWith("\n")).toBe(true);
		expect(stderr).toBe("");
	});

	test("reads stdin when the file is absent or -", async () => {
		let absent = await run(["query", "$.store.book[0].price"], STORE);
		let dash = await run(["query", "$.store.book[0].price", "-"], STORE);

		expect(absent.code).toBe(0);
		expect(JSON.parse(absent.stdout)).toEqual([8.95]);
		expect(dash.stdout).toBe(absent.stdout);
	});

	test("prints normalized paths with --paths", async () => {
		let { code, stdout } = await run(["query", "$..price", "store.json", "--paths"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual([
			"$['store']['book'][0]['price']",
			"$['store']['book'][1]['price']",
			"$['store']['book'][2]['price']",
		]);
	});

	test("prints the first match alone with --first", async () => {
		let value = await run(["query", "$.store.book[*]", "store.json", "--first"]);
		let path = await run(["query", "$.store.book[*]", "store.json", "--first", "--paths"]);

		expect(value.code).toBe(0);
		expect(JSON.parse(value.stdout)).toEqual({ title: "Sayings of the Century", price: 8.95 });
		expect(JSON.parse(path.stdout)).toBe("$['store']['book'][0]");
	});

	test("prints an empty array and exits 0 when nothing matches", async () => {
		let all = await run(["query", "$.missing", "store.json"]);
		let first = await run(["query", "$.missing", "store.json", "--first"]);

		expect(all.code).toBe(0);
		expect(JSON.parse(all.stdout)).toEqual([]);
		expect(first.code).toBe(0);
		expect(first.stdout).toBe("");
	});

	test("exits 1 when nothing matches under --fail-empty", async () => {
		let empty = await run(["query", "$.missing", "store.json", "--fail-empty"]);
		let found = await run(["query", "$.store", "store.json", "--fail-empty"]);

		expect(empty.code).toBe(1);
		expect(JSON.parse(empty.stdout)).toEqual([]);
		expect(empty.stderr).toContain("No match");
		expect(found.code).toBe(0);
	});

	test("exits 2 on an invalid expression, pointing at its offset", async () => {
		let { code, stdout, stderr } = await run(["query", "$.store[?", "store.json"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("Invalid JSONPath expression:");
		expect(stderr).toContain("(at offset 9)");
		expect(stderr).toContain("  $.store[?\n           ^");
	});

	test("exits 2 naming a file that is missing or not JSON", async () => {
		let missing = await run(["query", "$", "nope.json"]);
		let broken = await run(["query", "$", "broken.json"]);

		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("Cannot read nope.json");
		expect(broken.code).toBe(2);
		expect(broken.stderr).toContain("broken.json is not JSON");
	});

	test("exits 2 without an expression", async () => {
		let { code, stdout } = await run(["query"], STORE);

		expect(code).toBe(2);
		expect(stdout).toBe("");
	});
});
