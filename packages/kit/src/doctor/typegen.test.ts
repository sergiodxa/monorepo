/**
 * The `typegen` check over fixture projects: types newer than every source pass, types older
 * than one source or never generated warn with `sdxc run typegen`, and no Worker config skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { typegenCheck } from "./typegen.js";

afterEach(removeFixtures);

/** The Worker config and both env files, every one written before the types. */
const SOURCES = {
	"cloudflare.config.ts": "export default {};\n",
	".dev.vars": "SECRET=local\n",
	".env.example": "SECRET=\n",
	".cloudflare/types/index.d.ts": "interface Env {}\n",
};

describe("typegenCheck", () => {
	test("passes when the types are newer than the config and the env files", async () => {
		let context = await fixture(SOURCES, {
			modified: {
				"cloudflare.config.ts": 1_000,
				".dev.vars": 1_000,
				".env.example": 1_000,
				".cloudflare/types/index.d.ts": 2_000,
			},
		});

		expect((await typegenCheck.run(context)).status).toBe("pass");
	});

	test("warns, naming each source that changed after the types were generated", async () => {
		let context = await fixture(SOURCES, {
			modified: {
				"cloudflare.config.ts": 3_000,
				".dev.vars": 1_000,
				".env.example": 3_000,
				".cloudflare/types/index.d.ts": 2_000,
			},
		});

		expect(await typegenCheck.run(context)).toEqual({
			status: "warn",
			message: ".cloudflare/types/index.d.ts is older than what it is generated from",
			findings: [
				"cloudflare.config.ts changed after the types were generated",
				".env.example changed after the types were generated",
			],
			fix: "sdxc run typegen",
		});
	});

	test("warns when the types were never generated", async () => {
		let context = await fixture({ "cloudflare.config.ts": "export default {};\n" });

		expect(await typegenCheck.run(context)).toMatchObject({
			status: "warn",
			message:
				"The Worker's env types were never generated; .cloudflare/types/index.d.ts is missing",
			fix: "sdxc run typegen",
		});
	});

	test("skips a project without cloudflare.config.ts", async () => {
		expect((await typegenCheck.run(await fixture({}))).status).toBe("skip");
	});
});
