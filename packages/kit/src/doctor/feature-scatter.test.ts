/**
 * The `feature-scatter` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { featureScatterCheck } from "./feature-scatter.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("featureScatterCheck", () => {
	test("passes aligned multi-layer features", async () => {
		let context = await fixture({
			"app/jobs/trials/send.ts": "export const send = 1;\n",
			"app/services/trials/run.ts": "export const run = 1;\n",
		});
		expect((await featureScatterCheck.run(context)).status).toBe("pass");
	});

	test("warns when a shared feature is missing from a peer layer", async () => {
		let context = await fixture({
			"app/jobs/trials/send.ts": "export const send = 1;\n",
			"app/services/trials/run.ts": "export const run = 1;\n",
			"app/jobs/digest/send.ts": "export const digest = 1;\n",
			"app/services/digest/run.ts": "export const digestRun = 1;\n",
			"app/policies/trials/can.ts": "export const can = 1;\n",
		});
		let result = await featureScatterCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings.some((finding) => finding.startsWith("digest:"))).toBe(true);
	});

	test("skips layer-specific folders", async () => {
		let context = await fixture({
			"app/jobs/digest/send.ts": "export const digest = 1;\n",
			"app/services/billing/run.ts": "export const billing = 1;\n",
		});
		expect((await featureScatterCheck.run(context)).status).toBe("skip");
	});
});
