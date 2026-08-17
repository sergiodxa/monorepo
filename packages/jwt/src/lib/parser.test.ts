/**
 * Covers the claim parser's contract: which reads succeed, and exactly which error
 * a failed read raises. The throwing behavior is the part that matters — token
 * classes call this from inside getters, so these tests pin the deviation from the
 * repo-wide `Result` convention in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { InvalidTypeError, MissingKeyError, ObjectParser, ParserError } from "./parser";

describe("ObjectParser", () => {
	test("refuses to wrap anything that is not an object", () => {
		expect(() => new ObjectParser("not an object")).toThrow(InvalidTypeError);
		expect(() => new ObjectParser(null)).toThrow(InvalidTypeError);
		expect(() => new ObjectParser(undefined)).toThrow(InvalidTypeError);
	});

	test("reports whether a key is present, including one holding null", () => {
		let parser = new ObjectParser({ present: "yes", empty: null });

		expect(parser.has("present")).toBe(true);
		expect(parser.has("empty")).toBe(true);
		expect(parser.has("absent")).toBe(false);
	});

	test("reads each supported type", () => {
		let parser = new ObjectParser({
			name: "Ada",
			age: 36,
			active: true,
			metadata: { role: "admin" },
		});

		expect(parser.string("name")).toBe("Ada");
		expect(parser.number("age")).toBe(36);
		expect(parser.boolean("active")).toBe(true);
		expect(parser.object("metadata").string("role")).toBe("admin");
	});

	test("returns the wrapped object from valueOf", () => {
		let claims = { sub: "user-123" };
		expect(new ObjectParser(claims).valueOf()).toBe(claims);
	});

	test("sees writes made to the wrapped object after construction", () => {
		// The token proxy writes unknown claims straight into the payload, so the
		// parser has to read through the same reference rather than a copy.
		let claims: Record<string, unknown> = {};
		let parser = new ObjectParser(claims);

		expect(parser.has("late")).toBe(false);
		claims.late = "arrived";

		expect(parser.string("late")).toBe("arrived");
	});
});

describe("ObjectParser, on a missing key", () => {
	let parser = new ObjectParser({ present: "yes" });

	test("throws MissingKeyError naming the key", () => {
		expect(() => parser.string("absent")).toThrow(new MissingKeyError("absent"));
		expect(() => parser.string("absent")).toThrow('Key "absent" does not exist');
	});

	test("throws for every typed read, not just strings", () => {
		expect(() => parser.get("absent")).toThrow(MissingKeyError);
		expect(() => parser.number("absent")).toThrow(MissingKeyError);
		expect(() => parser.boolean("absent")).toThrow(MissingKeyError);
		expect(() => parser.object("absent")).toThrow(MissingKeyError);
	});

	test("uses a name that survives serialization", () => {
		let error = new MissingKeyError("absent");

		expect(error.name).toBe("ParserMissingKeyError");
		expect(error).toBeInstanceOf(ParserError);
	});
});

describe("ObjectParser, on a wrong type", () => {
	let parser = new ObjectParser({
		age: 36,
		name: "Ada",
		active: "true",
		empty: null,
		roles: ["admin"],
	});

	test("throws InvalidTypeError naming both types", () => {
		expect(() => parser.string("age")).toThrow('Key "age" expected string but got number');
		expect(() => parser.number("name")).toThrow('Key "name" expected number but got string');
	});

	test("does not coerce a stringified boolean", () => {
		// An identity provider sending `email_verified: "true"` is sending something
		// the token class does not model; coercing it would turn that into a trusted
		// `true`.
		expect(() => parser.boolean("active")).toThrow(InvalidTypeError);
	});

	test("names null as null rather than as an object", () => {
		expect(() => parser.object("empty")).toThrow('Key "empty" expected object but got null');
	});

	test("names an array as an array", () => {
		expect(() => parser.string("roles")).toThrow('Key "roles" expected string but got array');
	});

	test("uses a name that survives serialization", () => {
		let error = new InvalidTypeError("age", "string", "number");

		expect(error.name).toBe("ParserInvalidTypeError");
		expect(error).toBeInstanceOf(ParserError);
	});
});
