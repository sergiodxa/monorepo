/**
 * Tests the GraphQL grammar, across both a schema definition and the documents
 * a client sends against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { graphql } from "./graphql.js";

/** The runs a rule claimed, with the plain text between them dropped. */
function painted(code: string) {
	return scan(code, graphql)
		.filter((token) => token.type !== "plain")
		.map((token) => [token.type, token.value]);
}

describe("graphql", () => {
	test("paints a comment", () => {
		expect(painted("# the monitors a team owns\nquery")).toEqual([
			["comment", "# the monitors a team owns"],
			["keyword", "query"],
		]);
	});

	test("paints a block string as one run", () => {
		expect(painted('"""\nA monitored endpoint.\n"""')).toEqual([
			["string", '"""\nA monitored endpoint.\n"""'],
		]);
	});

	test("paints a type definition", () => {
		expect(painted("type Monitor implements Node {")).toEqual([
			["keyword", "type"],
			["class-name", "Monitor"],
			["keyword", "implements"],
			["class-name", "Node"],
			["punctuation", "{"],
		]);
	});

	test("paints a field and its type", () => {
		expect(painted("id: ID!")).toEqual([
			["property", "id"],
			["punctuation", ":"],
			["class-name", "ID"],
			["operator", "!"],
		]);
	});

	test("paints a list type's brackets as modifiers", () => {
		expect(painted("checks: [Check!]!")).toEqual([
			["property", "checks"],
			["punctuation", ":"],
			["operator", "["],
			["class-name", "Check"],
			["operator", "!]!"],
		]);
	});

	test("paints a name in an argument list as an argument", () => {
		expect(painted("team(id: $teamId) {")).toEqual([
			["property", "team"],
			["punctuation", "("],
			["attr-name", "id"],
			["punctuation", ":"],
			["variable", "$teamId"],
			["punctuation", ")"],
			["punctuation", "{"],
		]);
	});

	test("returns to painting fields once the argument list closes", () => {
		expect(painted("monitors(first: 10) { url }")).toEqual([
			["property", "monitors"],
			["punctuation", "("],
			["attr-name", "first"],
			["punctuation", ":"],
			["number", "10"],
			["punctuation", ")"],
			["punctuation", "{"],
			["property", "url"],
			["punctuation", "}"],
		]);
	});

	test("paints a variable definition with a default", () => {
		expect(painted("query Q($first: Int = 10) {")).toEqual([
			["keyword", "query"],
			["class-name", "Q"],
			["punctuation", "("],
			["variable", "$first"],
			["punctuation", ":"],
			["class-name", "Int"],
			["operator", "="],
			["number", "10"],
			["punctuation", ")"],
			["punctuation", "{"],
		]);
	});

	test("paints an applied directive", () => {
		expect(painted('status: Status @deprecated(reason: "gone")')).toEqual([
			["property", "status"],
			["punctuation", ":"],
			["class-name", "Status"],
			["keyword", "@deprecated"],
			["punctuation", "("],
			["attr-name", "reason"],
			["punctuation", ":"],
			["string", '"gone"'],
			["punctuation", ")"],
		]);
	});

	test("paints a fragment spread", () => {
		expect(painted("...TeamFields")).toEqual([
			["operator", "..."],
			["class-name", "TeamFields"],
		]);
	});

	test("paints a union's members", () => {
		expect(painted("union Target = Monitor | CronJob")).toEqual([
			["keyword", "union"],
			["class-name", "Target"],
			["operator", "="],
			["class-name", "Monitor"],
			["operator", "|"],
			["class-name", "CronJob"],
		]);
	});

	test("paints the word literals", () => {
		expect(painted("filter(active: true, deleted: false, cursor: null)")).toEqual([
			["property", "filter"],
			["punctuation", "("],
			["attr-name", "active"],
			["punctuation", ":"],
			["boolean", "true"],
			["punctuation", ","],
			["attr-name", "deleted"],
			["punctuation", ":"],
			["boolean", "false"],
			["punctuation", ","],
			["attr-name", "cursor"],
			["punctuation", ":"],
			["keyword", "null"],
			["punctuation", ")"],
		]);
	});

	test("paints a field named after a keyword as a field", () => {
		expect(painted("type Alert { type: String }")).toEqual([
			["keyword", "type"],
			["class-name", "Alert"],
			["punctuation", "{"],
			["property", "type"],
			["punctuation", ":"],
			["class-name", "String"],
			["punctuation", "}"],
		]);
	});

	test("covers a document exactly", () => {
		let code = [
			"query Monitors($teamId: ID!) {",
			"  team(id: $teamId) {",
			"    ...TeamFields",
			"    monitors {",
			"      alias: url",
			"    }",
			"  }",
			"}",
			"",
		].join("\n");

		let tokens = scan(code, graphql);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens.filter((token) => token.type === "variable")).toHaveLength(2);
		expect(tokens).toContainEqual({ type: "attr-name", value: "id" });
		expect(tokens).toContainEqual({ type: "property", value: "alias" });
	});
});
