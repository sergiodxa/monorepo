/**
 * The `typegen` command, which hands type generation to `cf` in the project's root and stamps the
 * types as current even when `cf` found nothing to change.
 */

import { mkdir, stat, utimes, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { isFailure, wrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { TYPES_FILE } from "~/app/commands/typegen";
import { cli } from "~/app/initializers/cli";

describe("typegen", () => {
	test("generates the Worker's types with cf", async () => {
		let run = await invoke(cli, ["typegen"], { exec: { "cf workers types": { code: 0 } } });

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([["cf", "workers", "types"]]);
	});

	test("stamps types cf left unchanged, so sdxc doctor reads them as current", async () => {
		if (isFailure(await wrap(() => stat(TYPES_FILE)))) {
			await mkdir(dirname(TYPES_FILE), { recursive: true });
			await writeFile(TYPES_FILE, "");
		}
		await utimes(TYPES_FILE, new Date(0), new Date(0));
		let started = Date.now();

		await invoke(cli, ["typegen"], { exec: { "cf workers types": { code: 0 } } });

		expect((await stat(TYPES_FILE)).mtimeMs).toBeGreaterThanOrEqual(started - 1_000);
	});
});
