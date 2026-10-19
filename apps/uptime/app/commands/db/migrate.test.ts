/**
 * `db migrate --remote`, which hands the chain to `wrangler d1 migrations apply` for the production
 * database named in `wrangler.jsonc`; with `--pending` it reads `wrangler d1 migrations list`
 * instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("db migrate", () => {
	test("--remote applies the chain through wrangler to the configured database", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote"], {
			exec: { "bunx wrangler d1 migrations apply ping --remote": { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec[0]?.command).toEqual([
			"bunx",
			"wrangler",
			"d1",
			"migrations",
			"apply",
			"ping",
			"--remote",
		]);
	});

	test("--remote --pending prints each migration production lacks and applies nothing", async () => {
		let table = [
			"Migrations to be applied:",
			"┌───────────────┐",
			"│ Name          │",
			"├───────────────┤",
			"│ 0001_init.sql │",
			"├───────────────┤",
			"│ 0002_tags.sql │",
			"└───────────────┘",
		].join("\n");
		let run = await invoke(cli, ["db", "migrate", "--remote", "--pending"], {
			exec: { "bunx wrangler d1 migrations list ping --remote": { stdout: table } },
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("0001_init.sql\n0002_tags.sql\n");
		expect(run.exec.map((call) => call.command.slice(0, 5))).toEqual([
			["bunx", "wrangler", "d1", "migrations", "list"],
		]);
	});

	test("--remote --pending prints nothing when production is up to date", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote", "--pending"], {
			exec: {
				"bunx wrangler d1 migrations list ping --remote": {
					stdout: "✅ No migrations to apply!\n",
				},
			},
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("");
	});

	test("--remote --pending fails on output it cannot read", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote", "--pending"], {
			exec: {
				"bunx wrangler d1 migrations list ping --remote": { stdout: "Something unexpected\n" },
			},
		});

		expect(run.code).toBe(1);
	});
});
