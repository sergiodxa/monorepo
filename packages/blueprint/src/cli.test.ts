/**
 * Tests for the `sdxc-blueprint` command line: listing blueprints, the help a blueprint's stubs
 * generate, runs missing values, dry runs, conflicts and forced replaces, driven through
 * `invoke()` in a temporary project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** The project each test runs in. */
let cwd = "";

/** Writes `text` at `path` under the project, creating folders. */
async function put(path: string, text: string): Promise<void> {
	await mkdir(dirname(join(cwd, path)), { recursive: true });
	await writeFile(join(cwd, path), text);
}

/** A blueprint with an index and a test stub, a flag and a list. */
async function flagBlueprint(): Promise<void> {
	await put(
		".config/blueprint/flag/index.stub",
		[
			"---",
			"to: app/flags/{{name | kebab}}.ts",
			"description: A feature flag with its default",
			"---",
			"export const {{name | snake | upper}} = flag();",
			"{{#if beta}}",
			"export const BETA = true;",
			"{{/if}}",
			"{{#each variants}}",
			'export const {{item | snake | upper}} = "{{item}}";',
			"{{/each}}",
			"",
		].join("\n"),
	);
	await put(
		".config/blueprint/flag/test.stub",
		"---\nto: app/flags/{{name | kebab}}.test.ts\n---\ntest({{name | camel}});\n",
	);
}

/** Runs the program in the project. */
function run(...argv: string[]) {
	return invoke(cli, argv, { cwd });
}

beforeEach(async () => {
	cwd = await mkdtemp(join(tmpdir(), "sdxc-blueprint-"));
});
afterEach(async () => {
	await rm(cwd, { recursive: true, force: true });
});

describe("--list", () => {
	test("names folder and single-file blueprints with their descriptions", async () => {
		await flagBlueprint();
		await put(".config/blueprint/note.stub", "---\nto: notes/{{name}}.md\n---\n# {{name}}\n");

		let listed = await run("--list");

		expect(listed.code).toBe(0);
		expect(listed.stdout).toBe("  flag  A feature flag with its default\n  note\n");
	});

	test("prints the blueprints as data", async () => {
		await flagBlueprint();

		let listed = await run("--list", "--json");

		expect(JSON.parse(listed.stdout)).toEqual([
			{
				name: "flag",
				description: "A feature flag with its default",
				path: ".config/blueprint/flag",
			},
		]);
	});

	test("says where to add one when there are none", async () => {
		let listed = await run("--list");

		expect(listed.stdout).toBe("No blueprints in .config/blueprint\n");
	});
});

describe("help", () => {
	test("lists each value from the stubs and the files a blueprint writes", async () => {
		await flagBlueprint();

		let help = await run("flag", "--help");

		expect(help.code).toBe(0);
		expect(help.stdout).toBe(
			[
				"flag — A feature flag with its default",
				"",
				"Usage: sdxc-blueprint flag --name <text> [--beta] [--variants <text>…]",
				"",
				"Values:",
				"  --name <text>      required; used in index.stub:2, index.stub:5, test.stub:2, and 1 more",
				"  --beta             flag; used in index.stub:6",
				"  --variants <text>  repeatable; used in index.stub:9",
				"",
				"Writes:",
				"  app/flags/{{name | kebab}}.ts  (index.stub)",
				"  app/flags/{{name | kebab}}.test.ts  (test.stub)",
				"",
			].join("\n"),
		);
	});

	test("prints the same help, then what is missing, when a value is left out", async () => {
		await flagBlueprint();

		let missing = await run("flag");

		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("Usage: sdxc-blueprint flag --name <text>");
		expect(missing.stderr).toContain("Missing --name");
	});

	test("prints the program's help with its blueprints when run bare", async () => {
		await flagBlueprint();

		let bare = await run();

		expect(bare.code).toBe(2);
		expect(bare.stderr).toContain("sdxc-blueprint <blueprint> [values]");
		expect(bare.stderr).toContain("  flag  A feature flag with its default");
	});

	test("suggests the closest blueprint for a typo", async () => {
		await flagBlueprint();

		let typo = await run("flga", "--name", "x");

		expect(typo.code).toBe(2);
		expect(typo.stderr).toContain('No blueprint "flga" in .config/blueprint; did you mean "flag"?');
	});
});

describe("a run", () => {
	test("writes every stub with flags, lists and filters applied", async () => {
		await flagBlueprint();

		let written = await run(
			"flag",
			"--name",
			"checkoutV2",
			"--beta",
			"--variants",
			"control",
			"--variants=new-flow",
		);

		expect(written.code).toBe(0);
		expect(written.stdout).toBe(
			"created   app/flags/checkout-v2.ts\ncreated   app/flags/checkout-v2.test.ts\n",
		);
		expect(await readFile(join(cwd, "app/flags/checkout-v2.ts"), "utf8")).toBe(
			[
				"export const CHECKOUT_V2 = flag();",
				"export const BETA = true;",
				'export const CONTROL = "control";',
				'export const NEW_FLOW = "new-flow";',
				"",
			].join("\n"),
		);
		expect(await readFile(join(cwd, "app/flags/checkout-v2.test.ts"), "utf8")).toBe(
			"test(checkoutV2);\n",
		);
	});

	test("reports the plan on a dry run and writes nothing", async () => {
		await flagBlueprint();
		await put("app/flags/beta.ts", "old");

		let dry = await run("flag", "--name", "beta", "--dry-run", "--json");

		expect(dry.code).toBe(1);
		expect(JSON.parse(dry.stdout)).toEqual({
			blueprint: "flag",
			written: false,
			files: [
				{ path: "app/flags/beta.ts", action: "conflict" },
				{ path: "app/flags/beta.test.ts", action: "create" },
			],
			conflicts: ["app/flags/beta.ts"],
		});
		expect(await readFile(join(cwd, "app/flags/beta.ts"), "utf8")).toBe("old");
	});

	test("stops on a file that exists, naming it, until forced", async () => {
		await flagBlueprint();
		await put("app/flags/beta.ts", "old");

		let stopped = await run("flag", "--name", "beta");
		let forced = await run("flag", "--name", "beta", "--force");

		expect(stopped.code).toBe(1);
		expect(stopped.stderr).toContain(
			"Nothing was written. These files exist already: app/flags/beta.ts",
		);
		expect(forced.code).toBe(0);
		expect(forced.stdout).toContain("replaced  app/flags/beta.ts");
		expect(await readFile(join(cwd, "app/flags/beta.ts"), "utf8")).toBe(
			"export const BETA = flag();\n",
		);
	});

	test("refuses unknown values with a suggestion", async () => {
		await flagBlueprint();

		let typo = await run("flag", "--nmae", "x");

		expect(typo.code).toBe(2);
		expect(typo.stderr).toContain("Unknown value --nmae; did you mean --name?");
	});

	test("refuses a stub that uses one of the program's own flags as a value", async () => {
		await put(".config/blueprint/bad.stub", "---\nto: x.ts\n---\n{{#if force}}x{{/if}}\n");

		let bad = await run("bad");

		expect(bad.code).toBe(2);
		expect(bad.stderr).toContain("{{force}} takes the name of sdxc-blueprint's own --force");
	});

	test("refuses a stub without a path to write", async () => {
		await put(".config/blueprint/bad.stub", "hello\n");

		let bad = await run("bad");

		expect(bad.code).toBe(2);
		expect(bad.stderr).toContain(".config/blueprint/bad.stub: Front matter to:");
	});
});
