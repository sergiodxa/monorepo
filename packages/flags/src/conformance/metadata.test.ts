/**
 * `metadata.feature`, scenario by scenario: what a resolved flag carries when
 * the flag set attaches metadata to it, and what it carries when it does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Client } from "../core/client.js";

import { createFlags } from "../client/index.js";
import { InMemoryProvider } from "../provider/memory.js";
import { testFlags } from "../provider/test-flags.js";

import { scenarios } from "./feature.js";

/** Every scenario heading this file transcribes, as `metadata.feature` writes it. */
const TRANSCRIBED = ["Returns metadata", "Returns no metadata"];

/** Given a stable provider. */
async function stable(): Promise<Client> {
	let flags = createFlags({ provider: () => new InMemoryProvider(testFlags()) });
	await flags.ready();
	return flags.getClient();
}

test("every scenario of metadata.feature is transcribed", () => {
	let declared = scenarios("metadata.feature");

	expect(TRANSCRIBED.length).toBeGreaterThanOrEqual(2);
	expect(declared.filter((title) => !TRANSCRIBED.includes(title))).toEqual([]);
});

test("Returns metadata", async () => {
	let client = await stable();

	let details = await client.booleanDetails("metadata-flag", true);

	expect(details.flagMetadata).toEqual({
		string: "1.0.2",
		integer: 2,
		float: 0.1,
		boolean: true,
	});
});

describe("Returns no metadata", () => {
	test.each([
		{ key: "boolean-flag", flagType: "Boolean", defaultValue: true },
		{ key: "integer-flag", flagType: "Integer", defaultValue: 23 },
		{ key: "float-flag", flagType: "Float", defaultValue: 2.3 },
		{ key: "string-flag", flagType: "String", defaultValue: "value" },
	])("$flagType $key", async ({ key, flagType, defaultValue }) => {
		let client = await stable();

		let details =
			flagType === "Boolean"
				? await client.booleanDetails(key, defaultValue as boolean)
				: flagType === "String"
					? await client.stringDetails(key, defaultValue as string)
					: await client.numberDetails(key, defaultValue as number);

		expect(details.flagMetadata).toEqual({});
	});
});
