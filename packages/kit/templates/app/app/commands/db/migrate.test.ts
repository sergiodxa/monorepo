/**
 * `db migrate --remote`, which hands the chain to `cf d1 migrations apply` for the production
 * database named in `cloudflare.config.ts`, and lists what it would apply with `--pending`.
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vite-plus/test";

import { cli } from "~/app/initializers/cli";

describe("db migrate", () => {
	test("--remote applies the chain through cf to the configured database", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote"], {
			exec: {
				"cf d1 migrations apply 00000000-0000-4000-8000-000000000000 --dir database/migrations": {
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
			"00000000-0000-4000-8000-000000000000",
		]);
	});

	test("--remote --pending prints each migration production lacks and applies nothing", async () => {
		let run = await invoke(cli, ["db", "migrate", "--remote", "--pending"], {
			exec: {
				"cf d1 migrations list 00000000-0000-4000-8000-000000000000 --dir database/migrations": {
					stdout: JSON.stringify([{ Name: "0001_init.sql" }, { Name: "0002_tags.sql" }]),
				},
			},
		});

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("0001_init.sql\n0002_tags.sql\n");
		expect(run.exec.map((call) => call.command.slice(0, 4))).toEqual([
			["cf", "d1", "migrations", "list"],
		]);
	});
});
