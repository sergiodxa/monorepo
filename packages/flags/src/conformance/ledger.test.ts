/**
 * The conformance ledger: every normative requirement of the vendored
 * OpenFeature specification is either covered by a test named for it, declined
 * with the condition that excuses it, or listed as pending.
 *
 * A specification bump then fails here with the list of requirements it added,
 * rather than quietly leaving them unimplemented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vitest";

import { DECLINED, PENDING } from "./declined.js";

/** One normative statement, in the shape the specification's own extraction writes it. */
interface Rule {
	id: string;
	machine_id: string;
	content: string;
	"RFC 2119 keyword": string | null;
	children: Rule[];
}

/** What the conformance clause counts: fail one of these and the implementation is not compliant. */
const NORMATIVE = new Set(["MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT"]);

/**
 * How many requirements are still owed. Later phases drain `PENDING` and lower
 * this number with it, so the assertion below can only ever be met by covering
 * more of the specification.
 */
const PENDING_BASELINE = 0;

/** The rule count of the vendored release, low enough to clear and high enough to catch a truncated file. */
const RULE_FLOOR = 120;

/** Unaccounted requirements named in the failure message, beyond which the list stops being readable. */
const REPORTED = 25;

/** Nested rules carry requirements of their own, so the tree is read as one flat list. */
function flatten(rules: Rule[]): Rule[] {
	return rules.flatMap((rule) => [rule, ...flatten(rule.children ?? [])]);
}

const RULES = flatten(
	(
		JSON.parse(
			readFileSync(
				new URL("../../../../docs/vendor/openfeature/specification.json", import.meta.url),
				"utf8",
			),
		) as { rules: Rule[] }
	).rules,
);

/** The ledger keys on the requirement number, which is what a test title names. */
function number(rule: Rule): string {
	return rule.id.split(" ").at(-1) ?? rule.id;
}

const NUMBERS = new Set(RULES.map(number));

const REQUIRED = RULES.filter((rule) => NORMATIVE.has(rule["RFC 2119 keyword"] ?? ""));

/** A title opening a `test`, `describe`, `it` or `test.each` block. */
const TITLE =
	/(?:describe|test|it)(?:\.each\s*\([\s\S]*?\)\s*)?\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

const NAMED = /Requirement\s+(\d+(?:\.\d+)+)/g;

/** The suite this package exports registers tests of its own, so its titles count too. */
const SUITE = "testing/conformance.ts";

/**
 * What this package's own tests claim. A requirement counts as covered when a
 * test is named for it, so the claim and the assertion live in one place.
 */
function covered(): Set<string> {
	let source = new URL("../", import.meta.url);
	let found = new Set<string>();

	for (let entry of readdirSync(source, { recursive: true, encoding: "utf8" })) {
		if (!entry.endsWith(".test.ts") && !entry.endsWith(SUITE)) continue;

		let text = readFileSync(new URL(entry, source), "utf8");

		for (let [, double, single, backtick] of text.matchAll(TITLE)) {
			let title = double ?? single ?? backtick ?? "";
			for (let [, id] of title.matchAll(NAMED)) if (id) found.add(id);
		}
	}

	return found;
}

/** Names the requirements nothing has said anything about, with enough of each to act on. */
function summarize(rules: Rule[]): string {
	let lines = rules
		.slice(0, REPORTED)
		.map((rule) => `  ${rule.id} [${rule["RFC 2119 keyword"]}] ${rule.content.trim()}`);

	if (rules.length > REPORTED) lines.push(`  …and ${rules.length - REPORTED} more`);

	return [
		`${rules.length} normative requirement(s) are neither covered by a named test, declined, nor pending.`,
		"Name a test for each one, or add it to DECLINED with the condition that excuses it, or to PENDING.",
		...lines,
	].join("\n");
}

test("every normative requirement is accounted for", () => {
	let tested = covered();
	let unaccounted = REQUIRED.filter((rule) => {
		let id = number(rule);
		return !tested.has(id) && !(id in DECLINED) && !(id in PENDING);
	});

	expect(unaccounted, summarize(unaccounted)).toHaveLength(0);
});

test("a covered or declined requirement is no longer pending", () => {
	let tested = covered();
	let claimed = Object.keys(PENDING).filter((id) => tested.has(id) || id in DECLINED);

	expect(
		claimed,
		`These ids are in PENDING and also covered or declined; drop them from PENDING: ${claimed.join(", ")}`,
	).toHaveLength(0);
});

test("every ledger entry names a requirement the specification still has", () => {
	let missing = [...Object.keys(DECLINED), ...Object.keys(PENDING)].filter(
		(id) => !NUMBERS.has(id),
	);

	expect(
		missing,
		`These ledger ids are absent from the vendored specification, so they were renumbered or removed: ${missing.join(", ")}`,
	).toHaveLength(0);
});

test("the pending count only goes down", () => {
	expect(
		Object.keys(PENDING).length,
		"Lower PENDING_BASELINE to the new count once requirements leave PENDING.",
	).toBeLessThanOrEqual(PENDING_BASELINE);
});

test("the vendored specification is whole", () => {
	expect(RULES.length).toBeGreaterThan(RULE_FLOOR);
	expect(REQUIRED.length).toBeGreaterThan(100);
});
