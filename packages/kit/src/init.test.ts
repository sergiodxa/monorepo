/**
 * `sdxc init`: the rendered file, which every key of the schema reaches with its default or an
 * example, and the refusal to touch an existing configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as JSONC from "@sdxc/jsonc";
import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { parseConfig } from "./config.js";
import { SCHEMA_REFERENCE, init, renderConfig } from "./init.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An empty project. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-init-"));
	PROJECTS.push(root);
	await writeFile(join(root, "package.json"), "{}");
	return root;
}

/** The file `init` writes for the schema as it stands, which the built-in templates ship too. */
const EXPECTED = `{
	"$schema": "../node_modules/sdxc/src/kit/config.schema.json",
	"ui": {
		// Where \`sdxc ui add\` writes components
		"directory": "resources/components/ui",
		// Import prefix for the copies; inferred from tsconfig \`paths\` when omitted
		// "alias": "~/components/ui",
		// Copy a component's tests beside it
		"tests": false,
	},
	"make": {
		// Route contract \`sdxc make controller\` adds to, a module in routes/
		"routes": "web",
		// Migration chains by name; \`--chain <name>\` picks one
		"migrations": { "default": "database/migrations" },
		// Write a test beside every generated file except migrations and factories
		"tests": true,
		// Stubs here replace the built-in ones; \`sdxc make stubs\` copies them out
		"stubs": ".config/sdxc/stubs",
	},
	// Command run on every file the CLI writes or edits, paths appended
	// "format": ["bunx", "vp", "fmt"],
	// Where the CLI keeps its state; commit it with the project
	"lock": ".config/sdxc.lock.jsonl",
}
`;

describe("renderConfig", () => {
	test("spells out every default with its description, and comments out a key without one", () => {
		expect(unwrap(renderConfig())).toBe(EXPECTED);
	});

	test("renders a file that parses back to the defaults", () => {
		let parsed = unwrap(JSONC.parse(unwrap(renderConfig())));
		let loaded = unwrap(parseConfig(parsed, "/project", ".config/sdxc.jsonc"));

		expect(loaded.config).toEqual({
			...unwrap(parseConfig({}, "/project", null)).config,
			$schema: SCHEMA_REFERENCE,
		});
	});
});

describe("init", () => {
	test("writes .config/sdxc.jsonc, creating the folder", async () => {
		let root = await project();

		let outcome = unwrap(await init(root, { dryRun: false }));

		expect(outcome).toEqual({ path: ".config/sdxc.jsonc", content: EXPECTED, written: true });
		expect(await readFile(join(root, ".config/sdxc.jsonc"), "utf8")).toBe(EXPECTED);
	});

	test("renders without writing under --dry-run", async () => {
		let root = await project();

		let outcome = unwrap(await init(root, { dryRun: true }));

		expect(outcome.written).toBe(false);
		expect(outcome.content).toBe(EXPECTED);
		await expect(stat(join(root, ".config"))).rejects.toThrow();
	});

	test("names an existing configuration at either location and writes nothing", async () => {
		let atConfig = await project();
		await mkdir(join(atConfig, ".config"));
		await writeFile(join(atConfig, ".config/sdxc.jsonc"), "{ /* mine */ }");
		let atRoot = await project();
		await writeFile(join(atRoot, "sdxc.jsonc"), "{}");

		let first = await init(atConfig, { dryRun: false });
		let second = await init(atRoot, { dryRun: false });

		expect(isFailure(first) && first.error.message).toBe(
			".config/sdxc.jsonc already exists; sdxc init leaves it as it is",
		);
		expect(isFailure(second) && second.error.message).toBe(
			"sdxc.jsonc already exists; sdxc init leaves it as it is",
		);
		expect(await readFile(join(atConfig, ".config/sdxc.jsonc"), "utf8")).toBe("{ /* mine */ }");
	});
});
