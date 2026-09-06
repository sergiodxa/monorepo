/**
 * Guards that every locale declares the same keys as English. A key missing from a
 * dictionary renders as the key itself, which reaches a reader as raw text like
 * `landing.hero.title` rather than as an error anything would catch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import en from "./en";
import es from "./es";

/** A dictionary is nested objects of strings, so the guard walks both shapes alike. */
type Dictionary = { [key: string]: string | Dictionary };

/**
 * Flattens a dictionary into its dotted key paths, which is the form a lookup uses
 * and therefore the form two dictionaries have to agree on.
 */
function keyPaths(dictionary: Dictionary, prefix = ""): string[] {
	let paths: string[] = [];

	for (let [key, value] of Object.entries(dictionary)) {
		let path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") paths.push(path);
		else paths.push(...keyPaths(value, path));
	}

	return paths.sort();
}

describe("locales", () => {
	test("Spanish declares exactly the keys English does", () => {
		expect(keyPaths(es as Dictionary)).toEqual(keyPaths(en as Dictionary));
	});

	test("no translation is left empty", () => {
		for (let [name, dictionary] of [
			["en", en],
			["es", es],
		] as const) {
			for (let path of keyPaths(dictionary as Dictionary)) {
				let value = path
					.split(".")
					.reduce<unknown>((node, key) => (node as Dictionary)[key], dictionary);
				expect(value, `${name}.${path}`).not.toBe("");
			}
		}
	});

	test("keeps implementation detail out of what a reader sees", () => {
		for (let dictionary of [en, es]) {
			let copy = JSON.stringify(dictionary);
			for (let term of ["Durable Object", "SQLite", "Cloudflare", "Worker"]) {
				expect(copy).not.toContain(term);
			}
		}
	});
});
