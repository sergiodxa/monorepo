/**
 * Tests the app's flag definitions against its catalog. A flag fails quietly — a
 * misspelled key or a refused definition resolves to the default its call site passed,
 * which is the value the branch was written to avoid — so the agreement between the two
 * halves is asserted here rather than discovered in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseFlagSet } from "@sdxc/flags-engine";
import { beforeAll, describe, expect, test } from "vitest";

import { SWEEP_CONCURRENCY } from "~/app/lib/concurrency";
import { features, FLAG_SET, flags } from "~/app/lib/flags";

let snapshot = parseFlagSet(FLAG_SET);
let client = flags.getClient();

beforeAll(() => flags.ready());

describe("the definition set", () => {
	test("parses every definition it carries", () => {
		expect([...snapshot.failures]).toEqual([]);
	});

	test("defines exactly the keys the catalog names", () => {
		let declared = Object.values(features).map((entry) => entry.key);

		expect([...snapshot.flags.keys()].sort()).toEqual(declared.sort());
	});
});

describe("the shipped values", () => {
	/**
	 * The catalog's default is what a call site falls back to when nothing resolves, so
	 * one that disagrees with the definition makes an outage change behaviour rather
	 * than preserve it.
	 */
	test("serve what each catalog entry falls back to", async () => {
		expect(await client.get(features.adhocPingApi)).toBe(features.adhocPingApi.defaultValue);
		expect(await client.get(features.sweepConcurrency)).toBe(
			features.sweepConcurrency.defaultValue,
		);
	});

	test("leave the ad-hoc ping API open", async () => {
		expect(await client.get(features.adhocPingApi)).toBe(true);
	});

	test("sweep at the width the sweeps were written for", async () => {
		expect(await client.get(features.sweepConcurrency)).toBe(SWEEP_CONCURRENCY);
	});
});

describe("targeting", () => {
	/**
	 * Both flags resolve for a subject that carries nothing, which is what a job with no
	 * team and an unauthenticated request both look like.
	 */
	test("resolves with no context at all", async () => {
		let details = await client.booleanDetails(features.adhocPingApi.key, false);

		expect(details.value).toBe(true);
		expect(details.reason).toBe("STATIC");
	});
});
