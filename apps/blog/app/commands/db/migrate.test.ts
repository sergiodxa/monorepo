/**
 * `db migrate --remote`, which hands the chain to `wrangler d1 migrations apply` for the
 * production database `wrangler.jsonc` binds as `DB`.
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
			exec: { "bunx wrangler d1 migrations apply db --remote": { code: 0 } },
		});

		expect(run.code).toBe(0);
		expect(run.exec[0]?.command).toEqual([
			"bunx",
			"wrangler",
			"d1",
			"migrations",
			"apply",
			"db",
			"--remote",
		]);
	});
});
