/**
 * Guards that every locale declares the same keys as English, that every message parses as
 * MessageFormat 2, and that each one reads the same variables. A missing key or a broken
 * message reaches a reader as raw text rather than as an error anything would catch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";
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

/** Every locale beside the English source, which the others are compared against. */
const LOCALES = [
	["en", en],
	["es", es],
] as const;

/** Resolves a dotted key path to the message it names. */
function messageAt(dictionary: Dictionary, path: string): string {
	return String(
		path.split(".").reduce<unknown>((node, key) => (node as Dictionary)[key], dictionary),
	);
}

/**
 * Collects the names of every variable a parsed message references, declarations and
 * selectors included, so two translations agree on what a caller has to pass.
 */
function variableNames(node: unknown, names = new Set<string>()): Set<string> {
	if (Array.isArray(node)) {
		for (let child of node) variableNames(child, names);
	} else if (node && typeof node === "object") {
		let record = node as Record<string, unknown>;
		if (record.type === "variable" && typeof record.name === "string") names.add(record.name);
		for (let value of Object.values(record)) variableNames(value, names);
	}
	return names;
}

/** Parses a message, failing the test with the key and the parser's reason when it is invalid. */
function variablesOf(name: string, path: string, source: string): string[] {
	let result = parse(source);
	if (isFailure(result)) throw new Error(`${name}.${path}: ${result.error.message}`);
	return Array.from(variableNames(result.data)).sort();
}

describe("locales", () => {
	test("Spanish declares exactly the keys English does", () => {
		expect(keyPaths(es)).toEqual(keyPaths(en));
	});

	test("no translation is left empty", () => {
		for (let [name, dictionary] of LOCALES) {
			for (let path of keyPaths(dictionary)) {
				expect(messageAt(dictionary, path), `${name}.${path}`).not.toBe("");
			}
		}
	});

	test("every message parses as MessageFormat 2", () => {
		for (let [name, dictionary] of LOCALES) {
			for (let path of keyPaths(dictionary)) {
				expect(() => variablesOf(name, path, messageAt(dictionary, path))).not.toThrow();
			}
		}
	});

	test("every language reads the same variables as English", () => {
		for (let [name, dictionary] of LOCALES) {
			for (let path of keyPaths(en)) {
				expect(variablesOf(name, path, messageAt(dictionary, path)), `${name}.${path}`).toEqual(
					variablesOf("en", path, messageAt(en, path)),
				);
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
