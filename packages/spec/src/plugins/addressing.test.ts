/**
 * Tests for the addressing vocabulary `html` and `browser` share. They are the
 * contract both namespaces bind to, so every rule of ADR-018 §9 is checked here
 * once rather than twice, where the two could drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { ToolArg, Value } from "../values.js";

import type { ElementQuery, ParsedQuery } from "./addressing.js";

import {
	ambiguousMatch,
	describeQuery,
	formatCandidates,
	noMatch,
	parseAssertion,
	parseFill,
	parseQuery,
} from "./addressing.js";

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Unwrap a successful result, failing the test with the error otherwise. */
function ok<T>(result: Result<T, SpecError>): T {
	if (isFailure(result)) throw new Error(`expected success, got: ${result.error.message}`);
	return result.data;
}

/** Unwrap a failed result, failing the test with the value otherwise. */
function err(result: Result<unknown, SpecError>): SpecError {
	if (!isFailure(result)) throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	return result.error;
}

/** Parse a role-headed query written as `html.element` writes one. */
function parse(...args: ToolArg[]): Result<ParsedQuery, SpecError> {
	return parseQuery("html.element", args);
}

describe("matching", () => {
	test("a role lookup matches the accessible name exactly", () => {
		let parsed = ok(parse(word("button"), value("Sign in")));
		expect(parsed.query).toEqual<ElementQuery>({ kind: "role", role: "button", name: "Sign in" });
		expect(parsed.predicate).toEqual({ kind: "present" });
	});

	test("`containing` opts a role lookup into a substring", () => {
		let parsed = ok(parse(word("heading"), word("containing"), value("Portfolio")));
		expect(parsed.query).toEqual<ElementQuery>({
			kind: "role",
			role: "heading",
			nameContaining: "Portfolio",
		});
	});

	test("`exactly` on a name is refused, since names already match exactly", () => {
		let error = err(parse(word("link"), word("exactly"), value("Home")));
		expect(error.message).toContain("matches an accessible name exactly already");
		expect(error.message).toContain("containing");
	});

	test("a role lookup with no name addresses every element of that role", () => {
		let parsed = ok(parse(word("link"), word("count"), value(7)));
		expect(parsed.query).toEqual<ElementQuery>({ kind: "role", role: "link" });
		expect(parsed.predicate).toEqual({ kind: "count", count: 7 });
	});
});

describe("ordinals", () => {
	test("`first` and `last` opt into one of several matches", () => {
		expect(ok(parse(word("link"), value("Profile"), word("first"))).query.at).toBe("first");
		expect(ok(parse(word("link"), value("Profile"), word("last"))).query.at).toBe("last");
	});

	test("`nth` counts from 1, unlike an array index", () => {
		expect(ok(parse(word("link"), value("Profile"), word("nth"), value(2))).query.at).toBe(2);
		let error = err(parse(word("link"), value("Profile"), word("nth"), value(0)));
		expect(error.message).toContain("ordinals count from 1");
	});

	test("`count` is a set predicate, so an ordinal before it is a usage error", () => {
		let error = err(parse(word("link"), value("Profile"), word("first"), word("count"), value(2)));
		expect(error.message).toContain("count");
		expect(error.message).toContain("ordinal");
	});
});

describe("roles", () => {
	test("the roles that joined the vocabulary parse as roles", () => {
		for (let role of ["menuitem", "switch", "image"]) {
			expect(ok(parse(word(role), value("x"))).query.role).toBe(role);
		}
	});

	test("`textarea` is refused as a tag name, naming the role it exposes", () => {
		let error = err(parse(word("textarea"), value("Bio")));
		expect(error.message).toContain("addresses roles, not tag names");
		expect(error.message).toContain("textbox");
	});

	test("a tag with no role of its own is refused without a substitute", () => {
		let error = err(parse(word("div"), value("Anything")));
		expect(error.message).toContain("carries no role of its own");
	});

	test("a role the vocabulary never listed is still a role, since roles are open", () => {
		expect(ok(parse(word("tablist"))).query.role).toBe("tablist");
	});
});

describe("addressing by field name", () => {
	test("`field` sits where a role word sits", () => {
		let parsed = ok(parse(word("field"), value("tip")));
		expect(parsed.query).toEqual<ElementQuery>({ kind: "field", field: "tip" });
	});

	test("`value` narrows a group sharing one name, and asserts", () => {
		let parsed = ok(parse(word("field"), value("cadence"), word("value"), value("annual")));
		expect(parsed.query).toEqual<ElementQuery>({
			kind: "field",
			field: "cadence",
			value: "annual",
		});
		expect(parsed.predicate).toEqual({ kind: "value", value: "annual" });
	});

	test("`value` on a role lookup asserts without narrowing", () => {
		let parsed = ok(parse(word("textbox"), value("Tip"), word("value"), value("20")));
		expect(parsed.query.value).toBeUndefined();
		expect(parsed.predicate).toEqual({ kind: "value", value: "20" });
	});
});

describe("predicates", () => {
	test("`count` accepts any number of matches, zero included", () => {
		expect(ok(parse(word("link"), value("Profile"), word("count"), value(0))).predicate).toEqual({
			kind: "count",
			count: 0,
		});
	});

	test("`attribute` takes a name and a value compared as a string", () => {
		let parsed = ok(
			parse(word("link"), value("Home"), word("attribute"), value("href"), value("/")),
		);
		expect(parsed.predicate).toEqual({ kind: "attribute", name: "href", value: "/" });
	});

	test("`enabled` and `disabled` are the two states of one predicate", () => {
		expect(ok(parse(word("button"), value("Save"), word("enabled"))).predicate).toEqual({
			kind: "state",
			enabled: true,
		});
		expect(ok(parse(word("button"), value("Save"), word("disabled"))).predicate).toEqual({
			kind: "state",
			enabled: false,
		});
	});

	test("`in_viewport` parses here, for a backend that can answer it to answer", () => {
		expect(ok(parse(word("button"), value("Save"), word("in_viewport"))).predicate).toEqual({
			kind: "in_viewport",
		});
	});

	test("`exists` is the deliberate-absence predicate", () => {
		expect(ok(parse(word("button"), value("Save"), word("exists"))).predicate).toEqual({
			kind: "exists",
		});
	});

	test("an unknown word names every predicate the vocabulary has", () => {
		let error = err(parse(word("button"), value("Save"), word("visible")));
		expect(error.message).toContain('does not understand the word "visible"');
		expect(error.message).toContain("in_viewport");
	});

	test("a tool that only addresses takes no predicate", () => {
		let error = err(
			parseQuery("browser.click", [word("button"), value("Save"), word("exists")], {
				predicates: "narrow",
			}),
		);
		expect(error.message).toContain("browser.click");
		expect(error.message).toContain("takes no `exists` predicate");
		expect(error.message).toContain("browser.element");
	});

	test("narrowing admits `value` on a field, which is addressing", () => {
		let parsed = ok(
			parseQuery("browser.click", [word("field"), value("tip"), word("value"), value("annual")], {
				predicates: "narrow",
			}),
		);
		expect(parsed.query).toEqual<ElementQuery>({ kind: "field", field: "tip", value: "annual" });
		expect(parsed.predicate).toEqual({ kind: "present" });
	});

	test("narrowing refuses `value` on a role lookup, where it asserts", () => {
		let error = err(
			parseQuery(
				"browser.click",
				[word("radio"), value("Annual"), word("value"), value("annual")],
				{
					predicates: "narrow",
				},
			),
		);
		expect(error.message).toContain("narrows a group of fields sharing one name");
		expect(error.message).toContain("browser.element");
	});
});

describe("structural reads", () => {
	test("a cell is 1-based over body rows", () => {
		let parsed = ok(
			parseQuery("html.cell", [word("row"), value(1), word("column"), value(2)], {
				head: { kind: "cell" },
			}),
		);
		expect(parsed.query).toEqual<ElementQuery>({
			kind: "cell",
			cell: { row: 1, column: 2, includeHeader: false },
		});
	});

	test("`including header` counts the header rows", () => {
		let parsed = ok(
			parseQuery(
				"html.cell",
				[word("row"), value(1), word("column"), value(1), word("including"), word("header")],
				{ head: { kind: "cell" } },
			),
		);
		expect(parsed.query.cell?.includeHeader).toBe(true);
	});

	test("a definition reads the definition paired with a term", () => {
		let parsed = ok(
			parseQuery("html.definition", [value("Total")], { head: { kind: "definition" } }),
		);
		expect(parsed.query).toEqual<ElementQuery>({ kind: "definition", term: "Total" });
	});

	test("`count` addresses a set, which a cell and a definition are not", () => {
		let error = err(
			parseQuery("html.definition", [value("Total"), word("count"), value(2)], {
				head: { kind: "definition" },
			}),
		);
		expect(error.message).toContain("counts a role or field lookup");
	});
});

describe("filling and typing", () => {
	test("`fill … with` carries the addressing and the text", () => {
		let parsed = ok(
			parseFill("browser.fill", [word("textbox"), value("Email"), word("with"), value("a@b.c")]),
		);
		expect(parsed.query).toEqual<ElementQuery>({ kind: "role", role: "textbox", name: "Email" });
		expect(parsed.text).toBe("a@b.c");
	});

	test("`type … with` parses identically, the difference being the backend's", () => {
		let parsed = ok(
			parseFill("browser.type", [word("field"), value("tip"), word("with"), value(20)]),
		);
		expect(parsed.query).toEqual<ElementQuery>({ kind: "field", field: "tip" });
		expect(parsed.text).toBe("20");
	});

	test("a missing `with` names the word the form needs", () => {
		let error = err(parseFill("browser.fill", [word("textbox"), value("Email"), value("a@b.c")]));
		expect(error.message).toContain("`with`");
	});

	/** Narrowing is addressing, so the form that writes into a control keeps it. */
	test("`value` narrows a field group before `with`", () => {
		let parsed = ok(
			parseFill("browser.fill", [
				word("field"),
				value("cadence"),
				word("value"),
				value("annual"),
				word("with"),
				value("12"),
			]),
		);
		expect(parsed.query).toEqual<ElementQuery>({
			kind: "field",
			field: "cadence",
			value: "annual",
		});
		expect(parsed.text).toBe("12");
	});

	test("an assertion before `with` is refused, a fill asserting nothing", () => {
		let error = err(
			parseFill("browser.fill", [
				word("textbox"),
				value("Email"),
				word("enabled"),
				word("with"),
				value("a@b.c"),
			]),
		);
		expect(error.message).toContain("takes no `enabled` predicate");
	});
});

describe("the assertion forms of a value observable", () => {
	test("no argument reads the value", () => {
		expect(ok(parseAssertion("html.title", [value("<html>")], 1, "exact"))).toEqual({
			kind: "read",
		});
	});

	test("a bare string compares in the tool's own default mode", () => {
		expect(ok(parseAssertion("html.title", [value("<html>"), value("Home")], 1, "exact"))).toEqual({
			kind: "match",
			text: "Home",
			mode: "exact",
		});
		expect(
			ok(parseAssertion("html.text", [value("<html>"), value("Home")], 1, "substring")),
		).toEqual({ kind: "match", text: "Home", mode: "substring" });
	});

	test("`containing` and `exactly` are the two opt-ins", () => {
		expect(
			ok(
				parseAssertion(
					"html.meta",
					[value("<html>"), word("containing"), value("/og-")],
					1,
					"exact",
				),
			),
		).toEqual({ kind: "match", text: "/og-", mode: "substring" });
		expect(
			ok(
				parseAssertion(
					"html.text",
					[value("<html>"), word("exactly"), value("Home")],
					1,
					"substring",
				),
			),
		).toEqual({ kind: "match", text: "Home", mode: "exact" });
	});

	test("`exists` asks for presence rather than a comparison", () => {
		expect(ok(parseAssertion("html.meta", [value("<html>"), word("exists")], 1, "exact"))).toEqual({
			kind: "exists",
		});
	});
});

describe("the failure vocabulary", () => {
	test("an ambiguity lists every match with its position", () => {
		let error = ambiguousMatch("html.element", { kind: "role", role: "link", name: "Profile" }, [
			{ position: 1, tag: "a", name: "Profile" },
			{ position: 2, tag: "a", name: "Profile" },
		]);
		expect(error.message).toContain('matched 2 elements for a link named "Profile"');
		expect(error.message).toContain('#1 <a> "Profile", #2 <a> "Profile"');
		expect(error.remedy).toContain("nth <n>");
	});

	test("a candidate a backend knows only by role renders by role", () => {
		expect(formatCandidates([{ position: 3, role: "link", name: "" }])).toBe(
			"#3 link (no accessible name)",
		);
	});

	test("a miss names the same role under other names and the same name under other roles", () => {
		let error = noMatch(
			"html.element",
			{ kind: "role", role: "button", name: "Save" },
			{ names: ["Cancel", "Delete"], roles: ["link"] },
		);
		expect(error.message).toContain('a button named "Save" nowhere');
		expect(error.message).toContain('"Cancel", "Delete"');
		expect(error.message).toContain("That name is carried by: link");
		expect(error.remedy).toContain("`exists`");
	});

	test("a description says what a person would say", () => {
		expect(describeQuery({ kind: "role", role: "link", name: "Home", at: 2 })).toBe(
			'the 2nd link named "Home"',
		);
		expect(describeQuery({ kind: "field", field: "tip", value: "20" })).toBe(
			'a field named "tip" with the value "20"',
		);
		expect(describeQuery({ kind: "cell", cell: { row: 2, column: 1, includeHeader: true } })).toBe(
			"the cell at row 2, column 1 counting header rows",
		);
		expect(describeQuery({ kind: "definition", term: "Total" })).toBe('the definition of "Total"');
	});
});
