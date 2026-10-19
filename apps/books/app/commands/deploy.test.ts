/**
 * The `deploy` command, which uploads the existing build with `cf` from the project's root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("deploy", () => {
	test("uploads the Worker with cf", async () => {
		let run = await invoke(cli, ["deploy"], { exec: { "cf deploy --prebuilt": { code: 0 } } });

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([["cf", "deploy", "--prebuilt"]]);
	});

	test("--dry-run hands cf its own dry run", async () => {
		let run = await invoke(cli, ["deploy", "--dry-run"], {
			exec: { "cf deploy --prebuilt --dry-run": { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([
			["cf", "deploy", "--prebuilt", "--dry-run"],
		]);
	});

	test("fails when cf does", async () => {
		let run = await invoke(cli, ["deploy"], { exec: { "cf deploy --prebuilt": { code: 1 } } });

		expect(run.code).toBe(1);
	});
});
