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

import { features, FLAG_SET, flags, flagsFor } from "~/app/lib/flags";
import { READER_BUDGET } from "~/database/schema";

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
	 * The catalog's default is what a call site falls back to when nothing resolves, so one
	 * that disagrees with the definition makes an outage change behaviour rather than
	 * preserve it — the opposite of what a flag is for.
	 */
	test("serve what each catalog entry falls back to", async () => {
		/**
		 * Named one at a time rather than walked as a list: the catalog holds flags of two
		 * types, and a loop over it hands the client a value whose type it cannot narrow —
		 * which is the same reason a call site names one flag rather than looking one up.
		 */
		expect(await client.get(features.feedPollIntervalHours)).toBe(
			features.feedPollIntervalHours.defaultValue,
		);
		expect(await client.get(features.readerPostBudget)).toBe(
			features.readerPostBudget.defaultValue,
		);
		expect(await client.get(features.velocitySuggestionRate)).toBe(
			features.velocitySuggestionRate.defaultValue,
		);
		expect(await client.get(features.savedPosts)).toBe(features.savedPosts.defaultValue);
		expect(await client.get(features.infinitePagination)).toBe(
			features.infinitePagination.defaultValue,
		);
	});

	test("poll a feed once a day, which is what the schedule was written for", async () => {
		expect(await client.get(features.feedPollIntervalHours)).toBe(24);
	});

	test("hold a reader to the budget the sweep was sized against", async () => {
		expect(await client.get(features.readerPostBudget)).toBe(READER_BUDGET);
	});

	test("leave both of the newest surfaces on", async () => {
		expect(await client.get(features.savedPosts)).toBe(true);
		expect(await client.get(features.infinitePagination)).toBe(true);
	});
});

describe("what an object evaluates through", () => {
	/**
	 * A Durable Object answers in its own context, so the middleware that publishes
	 * `ctx.flags` never runs there and the object names its own subject instead.
	 */
	test("resolves for a subject an object names itself", async () => {
		let reader = await flagsFor("sub-1");

		expect(await reader.get(features.readerPostBudget)).toBe(READER_BUDGET);
	});

	test("resolves with no subject at all, which is what an anonymous request is", async () => {
		let details = await client.details(features.savedPosts);

		expect(details.value).toBe(true);
		expect(details.reason).toBe("STATIC");
	});
});
