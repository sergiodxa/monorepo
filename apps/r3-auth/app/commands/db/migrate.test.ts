/**
 * `db migrate --remote`, which hands the chain to `cf d1 migrations apply` for the production
 * database named in `cloudflare.config.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("db migrate", () => {
	test("--remote applies the chain through cf to the configured database", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote"], {
			exec: {
				"cf d1 migrations apply 1549b30f-b4ba-48b0-b08a-76b8003a37db --dir database/migrations": {
					code: 0,
				},
			},
		});

		expect(run.code).toBe(0);
		expect(run.exec[0]?.command.slice(0, 5)).toEqual([
			"cf",
			"d1",
			"migrations",
			"apply",
			"1549b30f-b4ba-48b0-b08a-76b8003a37db",
		]);
	});
});
