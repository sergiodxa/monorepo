/**
 * Guards that every message in the English bundle parses as MessageFormat 2. A broken
 * message renders as its raw key at runtime, and the only signal is a log warning, so the
 * syntax is checked here where a failure names the key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Messages } from "@sdxc/i18n";

import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import en from "./en";

/** Flattens a bundle into `[dottedKey, message]` pairs, the form a lookup uses. */
function entries(bundle: Messages, prefix = ""): [string, string][] {
	let pairs: [string, string][] = [];
	for (let [key, value] of Object.entries(bundle)) {
		let path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") pairs.push([path, value]);
		else pairs.push(...entries(value, path));
	}
	return pairs;
}

describe("locales", () => {
	test("every English message parses as MessageFormat 2", () => {
		let failures = entries(en).flatMap(([path, source]) => {
			let result = parse(source);
			return isFailure(result) ? [`${path}: ${result.error.message}`] : [];
		});
		expect(failures).toEqual([]);
	});
});
