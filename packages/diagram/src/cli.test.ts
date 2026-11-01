/**
 * Tests for the `sdxc-diagram` command line: what `render` and `check` print on each stream and
 * the exit code they answer for a file, piped stdin, an unsupported statement and a missing
 * file, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const VALID = "flowchart LR\n  A --> B\n";

const INVALID = "sequenceDiagram\n  A->>B: hi\n  end\n";

/** The directory each test runs in, holding `flow.mmd` and `broken.mmd`. */
const FIXTURE = { dir: "" };

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-diagram-"));
	await writeFile(join(FIXTURE.dir, "flow.mmd"), VALID, "utf8");
	await writeFile(join(FIXTURE.dir, "broken.mmd"), INVALID, "utf8");
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-diagram` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

describe("sdxc-diagram render", () => {
	test("writes the SVG of a file to stdout", async () => {
		let { code, stdout, stderr } = await run(["render", "flow.mmd"]);

		expect(code).toBe(0);
		expect(stdout).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
		expect(stdout.endsWith("</svg>\n")).toBe(true);
		expect(stderr).toBe("");
	});

	test("reads stdin when the file is absent or -", async () => {
		let absent = await run(["render"], VALID);
		let dash = await run(["render", "-"], VALID);

		expect(absent.code).toBe(0);
		expect(absent.stdout).toContain("<svg");
		expect(dash.stdout).toBe(absent.stdout);
	});

	test("writes to --output and leaves stdout empty", async () => {
		let { code, stdout, stderr } = await run(["render", "flow.mmd", "--output", "flow.svg"]);

		expect(code).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toContain("Wrote flow.svg");
		expect(await readFile(join(FIXTURE.dir, "flow.svg"), "utf8")).toMatch(/^<svg[\s\S]*<\/svg>\n$/);
	});

	test("names the drawing with --alt", async () => {
		let { stdout } = await run(["render", "flow.mmd", "--alt", "Checkout flow"]);

		expect(stdout).toContain("<title>Checkout flow</title>");
	});

	test("exits 2 with the line and column of a statement it cannot read", async () => {
		let { code, stdout, stderr } = await run(["render", "broken.mmd"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain('broken.mmd:3:3 "end" without a block to close');
	});

	test("exits 2 when the file cannot be read", async () => {
		let { code, stderr } = await run(["render", "missing.mmd"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read missing.mmd");
	});
});

describe("sdxc-diagram check", () => {
	test("reports a supported diagram as ok", async () => {
		let { code, stdout } = await run(["check", "flow.mmd"]);

		expect(code).toBe(0);
		expect(stdout).toBe("flow.mmd: ok\n");
	});

	test("exits 1 with the place of unsupported syntax", async () => {
		let { code, stdout, stderr } = await run(["check", "broken.mmd"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain('broken.mmd:3:3 "end" without a block to close');
	});

	test("names stdin as <stdin>", async () => {
		let { code, stderr } = await run(["check"], "pieChart\n");

		expect(code).toBe(1);
		expect(stderr).toContain('<stdin>:1:1 Unknown diagram type "pieChart"');
	});

	test("prints a JSON report with --json", async () => {
		let valid = await run(["check", "flow.mmd", "--json"]);
		let invalid = await run(["check", "broken.mmd", "--json"]);

		expect(valid.code).toBe(0);
		expect(JSON.parse(valid.stdout)).toEqual({ valid: true });
		expect(invalid.code).toBe(1);
		expect(invalid.stderr).toBe("");
		expect(JSON.parse(invalid.stdout)).toEqual({
			valid: false,
			reason: '"end" without a block to close',
			line: 3,
			column: 3,
		});
	});

	test("exits 2 when the file cannot be read", async () => {
		let { code } = await run(["check", "missing.mmd"]);

		expect(code).toBe(2);
	});
});
