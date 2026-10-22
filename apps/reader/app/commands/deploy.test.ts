/**
 * The `deploy` command, which uploads the Worker with `wrangler` from the project's root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vite-plus/test";

import { cli } from "~/app/initializers/cli";

describe("deploy", () => {
	test("uploads the Worker with wrangler", async () => {
		let run = await invoke(cli, ["deploy"], { exec: { "bunx wrangler deploy": { code: 0 } } });

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([["bunx", "wrangler", "deploy"]]);
	});

	test("--dry-run hands wrangler its own dry run", async () => {
		let run = await invoke(cli, ["deploy", "--dry-run"], {
			exec: { "bunx wrangler deploy --dry-run": { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([
			["bunx", "wrangler", "deploy", "--dry-run"],
		]);
	});

	test("fails when wrangler does", async () => {
		let run = await invoke(cli, ["deploy"], { exec: { "bunx wrangler deploy": { code: 1 } } });

		expect(run.code).toBe(1);
	});
});
