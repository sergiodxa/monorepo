/**
 * Configuration lookup and validation: the two locations, the defaults a missing file or key
 * gets, and one message per failing key with its path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { findConfigFile, loadConfig } from "./config.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project holding `files`, keyed by path relative to its root. */
async function project(files: Record<string, string> = {}): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-config-"));
	PROJECTS.push(root);
	for (let [path, content] of Object.entries({ "package.json": "{}", ...files })) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Every default, as a project without a configuration file runs with them. */
const DEFAULTS = {
	ui: { directory: "resources/components/ui", tests: false },
	make: {
		routes: "web",
		migrations: { default: "database/migrations" },
		tests: true,
		specs: true,
		stubs: ".config/sdxc/stubs",
	},
	doctor: {
		checks: ".config/sdxc/checks",
		migrations: { accept: [] },
		complexity: { max: 4 },
		moduleSize: { maxLines: 200 },
		crap: { max: 12, coverage: "coverage/coverage-final.json" },
		testRatio: { min: 0.3 },
		fanOut: { max: 15 },
		duplication: { minLines: 8 },
		mutation: { report: "reports/mutation/mutation.json", maxSurvived: 0 },
	},
	run: { entry: "bootstrap/cli.ts" },
	lock: ".config/sdxc.lock.jsonl",
};

describe("findConfigFile", () => {
	test("prefers .config/sdxc.jsonc, falls back to sdxc.jsonc, and answers null without either", async () => {
		expect(unwrap(await findConfigFile(await project({ ".config/sdxc.jsonc": "{}" })))).toBe(
			".config/sdxc.jsonc",
		);
		expect(unwrap(await findConfigFile(await project({ "sdxc.jsonc": "{}" })))).toBe("sdxc.jsonc");
		expect(unwrap(await findConfigFile(await project()))).toBeNull();
	});

	test("stops and names both files when both locations hold one", async () => {
		let root = await project({ ".config/sdxc.jsonc": "{}", "sdxc.jsonc": "{}" });

		let found = await findConfigFile(root);

		expect(isFailure(found) && found.error.message).toBe(
			"Found both .config/sdxc.jsonc and sdxc.jsonc; keep one configuration file and delete the other",
		);
	});
});

describe("loadConfig", () => {
	test("runs a project without a configuration file on the defaults", async () => {
		let loaded = unwrap(await loadConfig(await project()));

		expect(loaded).toEqual({ path: null, config: DEFAULTS });
	});

	test("reads comments and trailing commas and fills in every key left out", async () => {
		let root = await project({
			".config/sdxc.jsonc": [
				"{",
				'\t"$schema": "https://unpkg.com/@sdxc/kit/config.schema.json",',
				"\t// components live elsewhere here",
				'\t"ui": { "directory": "app/ui", },',
				'\t"format": ["bunx", "vp", "fmt"],',
				"}",
			].join("\n"),
		});

		let loaded = unwrap(await loadConfig(root));

		expect(loaded.path).toBe(".config/sdxc.jsonc");
		expect(loaded.config).toEqual({
			...DEFAULTS,
			$schema: "https://unpkg.com/@sdxc/kit/config.schema.json",
			ui: { directory: "app/ui", tests: false },
			format: ["bunx", "vp", "fmt"],
		});
	});

	test("reports every failing key on its own line with its path", async () => {
		let root = await project({
			"sdxc.jsonc": JSON.stringify({ ui: { tests: "yes", colour: "red" }, format: [], lok: "x" }),
		});

		let loaded = await loadConfig(root);

		expect(isFailure(loaded) && loaded.error.message.split("\n").sort()).toEqual([
			"sdxc.jsonc: format: Expected at least 1 items",
			"sdxc.jsonc: lok: Unknown key",
			"sdxc.jsonc: ui.colour: Unknown key",
			"sdxc.jsonc: ui.tests: Expected boolean",
		]);
	});

	test("reads accepted migration failures as a file and a column, and nothing else", async () => {
		let accept = [{ file: "0002_rename.sql", column: "display_name" }];
		let accepted = await loadConfig(
			await project({ "sdxc.jsonc": JSON.stringify({ doctor: { migrations: { accept } } }) }),
		);
		let partial = await loadConfig(
			await project({
				"sdxc.jsonc": JSON.stringify({
					doctor: { migrations: { accept: [{ file: "0002_rename.sql", message: "x" }] } },
				}),
			}),
		);

		expect(unwrap(accepted).config.doctor).toEqual({
			checks: ".config/sdxc/checks",
			migrations: { accept },
			complexity: { max: 4 },
			moduleSize: { maxLines: 200 },
			crap: { max: 12, coverage: "coverage/coverage-final.json" },
			testRatio: { min: 0.3 },
			fanOut: { max: 15 },
			duplication: { minLines: 8 },
			mutation: { report: "reports/mutation/mutation.json", maxSurvived: 0 },
		});
		expect(isFailure(partial) && partial.error.message.split("\n").sort()).toEqual([
			"sdxc.jsonc: doctor.migrations.accept.0.column: Expected string",
			"sdxc.jsonc: doctor.migrations.accept.0.message: Unknown key",
		]);
	});

	test("refuses a configured path outside the project root", async () => {
		let root = await project({
			"sdxc.jsonc": JSON.stringify({
				lock: "../state.jsonl",
				make: { migrations: { audit: "/var/migrations" } },
			}),
		});

		let loaded = await loadConfig(root);

		expect(isFailure(loaded) && loaded.error.message).toBe(
			[
				"sdxc.jsonc: lock: ../state.jsonl points outside the project root",
				"sdxc.jsonc: make.migrations.audit: /var/migrations must be relative to the project root",
			].join("\n"),
		);
	});

	test("names the file, line and column of a syntax error", async () => {
		let root = await project({ "sdxc.jsonc": '{\n\t"lock" "x"\n}' });

		let loaded = await loadConfig(root);

		expect(isFailure(loaded) && loaded.error.message).toMatch(
			/^sdxc\.jsonc: .* at line 2, column \d+$/,
		);
	});
});
