/**
 * What a dialect changes about the language: the built-ins it leaves out, the
 * operators it adds through `defineOperator`, and the schema it publishes for
 * its JSON form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, success, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test, vi } from "vitest";

import { createLanguage } from "./language.js";
import { defineOperator } from "./operator.js";

/** A whole number written as text, for an operator whose compile step can fail. */
const BOUND_SCHEMA = s.object({ bound: s.string() });

describe("builtins", () => {
	let rules = createLanguage({ builtins: ["all", "any", "not", "contains"] });

	test("evaluates the built-ins it keeps", () => {
		let compiled = unwrap(
			rules.compile({
				op: "all",
				of: [
					{ op: "contains", field: "title", value: "sponsored" },
					{ op: "not", of: { op: "contains", field: "author", value: "staff" } },
				],
			}),
		);

		expect(rules.evaluate(compiled, { title: "a sponsored post", author: "ada" })).toBe(true);
		expect(rules.evaluate(compiled, { title: "a sponsored post", author: "staff" })).toBe(false);
	});

	test.each([
		["matches", { op: "matches", field: "title", pattern: "a+" }],
		["always", { op: "always" }],
		["eq", { op: "eq", field: "title", value: "x" }],
	])("refuses %s, which it leaves out", (_, expression) => {
		expect(rules.compile(expression)).toMatchObject({ status: "failure", error: { path: "op" } });
		expect(s.parseSafe(rules.schema, expression).success).toBe(false);
	});
});

describe("defineOperator", () => {
	test("hands the operator the value already read from the path", () => {
		let even = defineOperator({
			op: "even",
			args: ["field"],
			schema: s.object({}),
			test: (value) => typeof value === "number" && value % 2 === 0,
		});
		let numbers = createLanguage({ operators: [even] });
		let compiled = unwrap(numbers.compile({ op: "even", field: "stats.seats" }));

		expect(numbers.evaluate(compiled, { stats: { seats: 4 } })).toBe(true);
		expect(numbers.evaluate(compiled, { stats: { seats: 3 } })).toBe(false);
	});

	test("answers false for a missing field before the operator's test runs", () => {
		let test_ = vi.fn(() => true);
		let anything = defineOperator({
			op: "anything",
			args: ["field"],
			schema: s.object({}),
			test: test_,
		});
		let language = createLanguage({ operators: [anything] });
		let compiled = unwrap(language.compile({ op: "anything", field: "ip" }));

		expect(language.evaluate(compiled, {})).toBe(false);
		expect(language.evaluate(compiled, { ip: null })).toBe(true);
		expect(test_).toHaveBeenCalledTimes(1);
	});

	test("prepares work once at compile time and hands it to every test", () => {
		let compile = vi.fn((node: { bound: string }) => success(Number.parseInt(node.bound, 10)));
		let under = defineOperator({
			op: "under",
			args: ["field", "bound"],
			schema: BOUND_SCHEMA,
			compile,
			test: (value, _node, bound) => typeof value === "number" && value < bound,
		});
		let language = createLanguage({ operators: [under] });
		let compiled = unwrap(language.compile({ op: "under", field: "age", bound: "18" }));

		expect(compiled).toEqual({ op: "under", field: "age", bound: "18", prepared: 18 });
		expect(language.evaluate(compiled, { age: 17 })).toBe(true);
		expect(language.evaluate(compiled, { age: 18 })).toBe(false);
		expect(compile).toHaveBeenCalledTimes(1);
	});

	test("fails the expression when the compile step fails, at the operator's node", () => {
		let under = defineOperator({
			op: "under",
			args: ["field", "bound"],
			schema: BOUND_SCHEMA,
			compile: (node) => {
				let bound = Number(node.bound);
				return Number.isInteger(bound)
					? success(bound)
					: failure(new Error(`"${node.bound}" is no whole number`));
			},
			test: (value, _node, bound) => typeof value === "number" && value < bound,
		});
		let language = createLanguage({ operators: [under] });

		expect(
			language.compile({ op: "not", of: { op: "under", field: "age", bound: "ten" } }),
		).toMatchObject({
			status: "failure",
			error: { path: "of", message: '"ten" is no whole number' },
		});
	});

	test("validates the operator's fields with its schema and its field with the language's", () => {
		let under = defineOperator({
			op: "under",
			args: ["field", "bound"],
			schema: BOUND_SCHEMA,
			test: () => true,
		});
		let language = createLanguage({ operators: [under] });

		expect(language.compile({ op: "under", field: "age", bound: 18 })).toMatchObject({
			error: { path: "bound" },
		});
		expect(language.compile({ op: "under", field: "", bound: "18" })).toMatchObject({
			error: { path: "field" },
		});
	});

	test("keeps every built-in beside the operators it adds", () => {
		let even = defineOperator({
			op: "even",
			args: ["field"],
			schema: s.object({}),
			test: (value) => typeof value === "number" && value % 2 === 0,
		});
		let language = createLanguage({ operators: [even] });
		let compiled = unwrap(
			language.compile({
				op: "any",
				of: [
					{ op: "even", field: "seats" },
					{ op: "eq", field: "plan", value: "pro" },
				],
			}),
		);

		expect(language.evaluate(compiled, { seats: 3, plan: "pro" })).toBe(true);
	});
});

describe("schema", () => {
	test("reads the JSON form as a Standard Schema", () => {
		let language = createLanguage({ reference: "segment" });
		let expression = {
			op: "any",
			of: [
				{ op: "segment", name: "internal" },
				{ op: "in", field: "country", values: ["AR", null] },
			],
		};

		expect(s.parseSafe(language.schema, expression)).toEqual({ success: true, value: expression });
		expect(language.schema["~standard"].vendor).toBe("data-schema");
	});

	test("keeps the discriminant narrow enough to switch on", () => {
		let language = createLanguage();
		let result = s.parseSafe(language.schema, { op: "eq", field: "country", value: "es" });

		expect(result.success).toBe(true);
		if (result.success && result.value.op === "eq") expect(result.value.field).toBe("country");
	});
});
