/**
 * The `typegen` command, which hands type generation to Wrangler in the project's root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("typegen", () => {
	test("generates the Worker's types with wrangler", async () => {
		let run = await invoke(cli, ["typegen"], { exec: { "bunx wrangler types": { code: 0 } } });

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([["bunx", "wrangler", "types"]]);
	});
});
