/**
 * The `about` command, run through the site's command line as `sdxc run about` runs it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

import manifest from "../../package.json" with { type: "json" };

describe("about", () => {
	test("prints the app's name and the versions it is built on", async () => {
		let run = await invoke(cli, ["about"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toContain(manifest.name);
		expect(run.stdout).toContain(`@sdxc/cli  ${manifest.dependencies["@sdxc/cli"]}`);
	});

	test("--json prints the same as one JSON document", async () => {
		let run = await invoke(cli, ["about", "--json"]);

		expect(JSON.parse(run.stdout)).toMatchObject({
			name: manifest.name,
			remix: manifest.dependencies.remix,
		});
	});
});
