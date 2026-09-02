/**
 * Tests the Ruby grammar, with an eye on the sigils — `@`, `$`, `:`, `#{}` —
 * that decide what a bare name means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { ruby } from "./ruby";

/** The runs a rule claimed, with the plain text between them dropped. */
function painted(code: string) {
	return scan(code, ruby)
		.filter((token) => token.type !== "plain")
		.map((token) => [token.type, token.value]);
}

describe("ruby", () => {
	test("paints a comment", () => {
		expect(painted('# frozen_string_literal: true\nrequire "json"')).toEqual([
			["comment", "# frozen_string_literal: true"],
			["keyword", "require"],
			["string", '"json"'],
		]);
	});

	test("paints a keyword", () => {
		expect(painted("def run\n  yield\nend")).toEqual([
			["keyword", "def"],
			["function", "run"],
			["keyword", "yield"],
			["keyword", "end"],
		]);
	});

	test("paints a single-quoted string, which carries no interpolation", () => {
		expect(painted("puts 'a #{b}'")).toEqual([["string", "'a #{b}'"]]);
	});

	test("paints an interpolation inside a double-quoted string as code", () => {
		expect(painted('"monitor #{@url} is up"')).toEqual([
			["string", '"monitor '],
			["punctuation", "#{"],
			["variable", "@url"],
			["punctuation", "}"],
			["string", ' is up"'],
		]);
	});

	test("keeps a bare hash in a string out of an interpolation", () => {
		expect(painted('"a # b"')).toEqual([["string", '"a # b"']]);
	});

	test("paints a word list as one string", () => {
		expect(painted("FIELDS = %w[id url status]")).toEqual([
			["class-name", "FIELDS"],
			["operator", "="],
			["string", "%w[id url status]"],
		]);
	});

	test("paints a symbol, in both spellings", () => {
		expect(painted("build(:up, status: :down)")).toEqual([
			["function", "build"],
			["punctuation", "("],
			["constant", ":up"],
			["punctuation", ","],
			["constant", "status:"],
			["constant", ":down"],
			["punctuation", ")"],
		]);
	});

	test("paints an instance, a class and a global variable", () => {
		expect(painted("@url @@count $stdout")).toEqual([
			["variable", "@url"],
			["variable", "@@count"],
			["variable", "$stdout"],
		]);
	});

	test("paints a capitalized name as the constant it is", () => {
		expect(painted("Uptime::Monitor.new(url)")).toEqual([
			["class-name", "Uptime"],
			["operator", "::"],
			["class-name", "Monitor"],
			["punctuation", "."],
			["function", "new"],
			["punctuation", "("],
			["punctuation", ")"],
		]);
	});

	test("paints a singleton method name past the dot", () => {
		expect(painted("def self.build(url)")).toEqual([
			["keyword", "def"],
			["keyword", "self"],
			["punctuation", "."],
			["function", "build"],
			["punctuation", "("],
			["punctuation", ")"],
		]);
	});

	test("paints the question mark as part of a predicate name", () => {
		expect(painted("def up?\n  true\nend")).toEqual([
			["keyword", "def"],
			["function", "up?"],
			["keyword", "true"],
			["keyword", "end"],
		]);
	});

	test("paints a number and keeps a range's dots as one operator", () => {
		expect(painted("(1..10)")).toEqual([
			["punctuation", "("],
			["number", "1"],
			["operator", ".."],
			["number", "10"],
			["punctuation", ")"],
		]);
	});

	test("paints a rescue clause", () => {
		expect(painted("rescue StandardError => error")).toEqual([
			["keyword", "rescue"],
			["class-name", "StandardError"],
			["operator", "=>"],
		]);
	});

	test("covers a class body exactly", () => {
		let code = [
			"module Uptime",
			"  class Monitor < Base",
			"    attr_accessor :url",
			"",
			"    def to_s",
			'      "monitor #{@url} (#{Base::FIELDS.length} fields)"',
			"    end",
			"  end",
			"end",
			"",
		].join("\n");

		let tokens = scan(code, ruby);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "keyword", value: "attr_accessor" });
		expect(tokens).toContainEqual({ type: "constant", value: ":url" });
		expect(
			tokens.filter((token) => token.type === "punctuation" && token.value === "#{"),
		).toHaveLength(2);
	});
});
