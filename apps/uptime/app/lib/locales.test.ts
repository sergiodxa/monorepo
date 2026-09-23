/**
 * Checks every locale bundle as MessageFormat 2: each message parses, and each language's
 * message uses the same variables as English, so a translation can never reference a value
 * the code does not pass or drop one it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Messages } from "@sdxc/i18n";

import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";

const LOCALES: Record<string, Messages> = { en, es, de, fr, it, ja };

/** Every message in a bundle keyed by its dotted path. */
function flatten(messages: Messages, prefix = ""): Map<string, string> {
	let entries = new Map<string, string>();
	for (let [key, value] of Object.entries(messages)) {
		let path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") entries.set(path, value);
		else for (let entry of flatten(value, path)) entries.set(...entry);
	}
	return entries;
}

/** The sorted names of every `$variable` a parsed message references, declarations included. */
function variablesOf(node: unknown, names = new Set<string>()): string[] {
	if (Array.isArray(node)) {
		for (let child of node) variablesOf(child, names);
	} else if (node && typeof node === "object") {
		if (Reflect.get(node, "type") === "variable") names.add(String(Reflect.get(node, "name")));
		for (let child of Object.values(node)) variablesOf(child, names);
	}
	return [...names].sort();
}

/** The variables of one message source, or the parse error message when it does not parse. */
function inspect(source: string): { variables: string[] } | { error: string } {
	let result = parse(source);
	if (isFailure(result)) return { error: result.error.message };
	return { variables: variablesOf(result.data) };
}

let english = flatten(en);

describe.each(Object.keys(LOCALES))("%s locale", (language) => {
	let messages = flatten(LOCALES[language] ?? {});

	test("every message parses as MessageFormat 2", () => {
		let failures = [...messages]
			.map(([key, source]) => ({ key, result: inspect(source) }))
			.filter(({ result }) => "error" in result);

		expect(failures).toEqual([]);
	});

	test("every message uses the same variables as English", () => {
		let mismatches = [...messages].flatMap(([key, source]) => {
			let reference = english.get(key);
			if (reference === undefined) return [];
			let own = inspect(source);
			let expected = inspect(reference);
			if (!("variables" in own) || !("variables" in expected)) return [];
			if (own.variables.join() === expected.variables.join()) return [];
			return [{ key, [language]: own.variables, en: expected.variables }];
		});

		expect(mismatches).toEqual([]);
	});
});
