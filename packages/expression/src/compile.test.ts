/**
 * What `compile` refuses and where it says the problem is: schema failures by
 * the path of the field at fault, patterns that do not compile, and references
 * that name nothing or reach a cycle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ExpressionError } from "./expression-error.js";
import { createLanguage } from "./language.js";

/** A language whose references are spelled the way shared conditions are named. */
const CONDITIONS = createLanguage({ reference: "segment" });

describe("compile", () => {
	test("returns the expression as written when no operator has work to prepare", () => {
		let expression = {
			op: "all",
			of: [
				{ op: "eq", field: "country", value: "AR" },
				{ op: "not", of: { op: "exists", field: "deletedAt" } },
			],
		};

		expect(unwrap(CONDITIONS.compile(expression))).toEqual(expression);
	});

	test("compiles a matches pattern once, with the v flag", () => {
		let compiled = unwrap(CONDITIONS.compile({ op: "matches", field: "email", pattern: "^ada@" }));

		expect(compiled).toMatchObject({ op: "matches", field: "email" });
		expect(compiled).toHaveProperty("pattern", expect.any(RegExp));
		expect((compiled as { pattern: RegExp }).pattern.flags).toBe("v");
	});

	test.each<[string, unknown, string, RegExp]>([
		[
			"an operator nobody named",
			{ op: "regex", field: "a", value: "b" },
			"op",
			/"regex" is not an operator of this language/,
		],
		["a comparison against another type", { op: "gt", field: "a", value: "2" }, "value", /number/i],
		["a comparison that names no field", { op: "eq", value: "es" }, "field", /string/i],
		["a field naming nothing", { op: "exists", field: "" }, "field", /context field/],
		["a structure compared as a scalar", { op: "eq", field: "a", value: {} }, "value", /./],
		[
			"a nested member holding no expression",
			{ op: "any", of: [{ op: "always" }, { op: "nope" }] },
			"of.1.op",
			/"nope" is not an operator/,
		],
		["a value that is no object at all", "plan.tier", "", /object/i],
	])("refuses %s, naming the path at fault", (_, expression, path, message) => {
		let compiled = CONDITIONS.compile(expression);

		expect(compiled).toMatchObject({ status: "failure" });
		if (isSuccess(compiled)) return;
		expect(compiled.error).toBeInstanceOf(ExpressionError);
		expect(compiled.error.path).toBe(path);
		expect(compiled.error.message).toMatch(message);
	});

	test("refuses a pattern the v flag rejects, at the pattern's path", () => {
		let compiled = CONDITIONS.compile({
			op: "any",
			of: [{ op: "always" }, { op: "matches", field: "email", pattern: "(" }],
		});

		expect(compiled).toMatchObject({
			status: "failure",
			error: { path: "of.1.pattern", message: 'Pattern "(" does not compile' },
		});
	});
});

describe("references", () => {
	test("carries the referenced expression into the node that names it", () => {
		let references = { eu: { op: "in", field: "country", values: ["ES", "FR"] } };

		expect(unwrap(CONDITIONS.compile({ op: "segment", name: "eu" }, { references }))).toEqual({
			op: "segment",
			name: "eu",
			of: { op: "in", field: "country", values: ["ES", "FR"] },
		});
	});

	test("resolves a reference once per references object, sharing the compiled tree", () => {
		let references = { internal: { op: "matches", field: "email", pattern: "@example\\.com$" } };

		let first = unwrap(CONDITIONS.compile({ op: "segment", name: "internal" }, { references }));
		let second = unwrap(
			CONDITIONS.compile({ op: "not", of: { op: "segment", name: "internal" } }, { references }),
		);

		expect(second).toMatchObject({ op: "not" });
		expect((second as { of: { of: unknown } }).of.of).toBe((first as { of: unknown }).of);
	});

	test("resolves a reference that names another reference", () => {
		let references = {
			staff: { op: "endsWith", field: "email", value: "@example.com" },
			internal: { op: "any", of: [{ op: "segment", name: "staff" }] },
		};
		let compiled = unwrap(CONDITIONS.compile({ op: "segment", name: "internal" }, { references }));

		expect(CONDITIONS.evaluate(compiled, { email: "ada@example.com" })).toBe(true);
		expect(CONDITIONS.evaluate(compiled, { email: "ada@acme.com" })).toBe(false);
	});

	test("refuses a reference to a name nobody declared, at the reference node", () => {
		let compiled = CONDITIONS.compile({
			op: "all",
			of: [{ op: "always" }, { op: "segment", name: "internal" }],
		});

		expect(compiled).toMatchObject({
			status: "failure",
			error: { path: "of.1", message: 'Unknown segment "internal"' },
		});
	});

	test("refuses a reference that reaches itself", () => {
		let compiled = CONDITIONS.compile(
			{ op: "segment", name: "staff" },
			{ references: { staff: { op: "segment", name: "staff" } } },
		);

		expect(compiled).toMatchObject({
			status: "failure",
			error: { path: "", message: 'Segment "staff" takes part in a reference cycle' },
		});
	});

	test("refuses a cycle through several references", () => {
		let references = {
			internal: { op: "any", of: [{ op: "segment", name: "staff" }] },
			staff: { op: "not", of: { op: "segment", name: "internal" } },
		};

		expect(CONDITIONS.compile({ op: "segment", name: "internal" }, { references })).toMatchObject({
			status: "failure",
			error: { message: /reference cycle/ },
		});
	});

	test("refuses a reference whose own expression does not validate, at the reference node", () => {
		let compiled = CONDITIONS.compile(
			{ op: "not", of: { op: "segment", name: "internal" } },
			{ references: { internal: { op: "endsWith", field: "email", value: 7 } } },
		);

		expect(compiled).toMatchObject({ status: "failure", error: { path: "of" } });
	});

	test("spells the reference operator however the language names it", () => {
		let rules = createLanguage({ reference: "rule" });
		let references = { pro: { op: "eq", field: "plan", value: "pro" } };
		let compiled = unwrap(rules.compile({ op: "rule", name: "pro" }, { references }));

		expect(rules.evaluate(compiled, { plan: "pro" })).toBe(true);
		expect(rules.compile({ op: "rule", name: "free" })).toMatchObject({
			error: { message: 'Unknown rule "free"' },
		});
		expect(
			rules.compile(
				{ op: "rule", name: "loop" },
				{ references: { loop: { op: "rule", name: "loop" } } },
			),
		).toMatchObject({
			error: { message: 'Rule "loop" takes part in a reference cycle' },
		});
	});

	test("has no reference operator in a language that names none", () => {
		let plain = createLanguage();

		expect(plain.compile({ op: "segment", name: "internal" })).toMatchObject({
			status: "failure",
			error: { path: "op" },
		});
	});
});
