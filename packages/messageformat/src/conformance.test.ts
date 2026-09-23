/**
 * Runs the Unicode MessageFormat working group's conformance suite, vendored in `test/`,
 * as this package's specification: every syntax, data model, selection, fallback, bidi and
 * built-in function case, with the suite's `:test:*` functions registered as custom ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { MessageFunction, MessageValue } from "./index.js";

import { MessageError, MessageFormat } from "./index.js";

/** One case of the suite, after the file's `defaultTestProperties` are applied. */
interface Case {
	description?: string;
	locale: string;
	src: string;
	bidiIsolation?: "default" | "none";
	params?: Array<{ name: string; value: unknown; type?: string }>;
	tags?: string[];
	exp?: string;
	expParts?: Array<Record<string, unknown>>;
	expErrors?: Array<{ type: string }>;
}

/** A suite file. */
interface Suite {
	scenario: string;
	defaultTestProperties?: Partial<Case>;
	tests: Case[];
}

/**
 * Functions the suite exercises that this package does not implement yet. A case whose
 * source calls one is skipped; every other case must pass.
 */
const UNIMPLEMENTED_FUNCTIONS = [
	":currency",
	":date",
	":datetime",
	":offset",
	":percent",
	":time",
	":unit",
];

/** Error names that make the constructor throw instead of formatting. */
const STATIC_ERRORS = new Set([
	"syntax-error",
	"variant-key-mismatch",
	"missing-fallback-variant",
	"missing-selector-annotation",
	"duplicate-declaration",
	"duplicate-option-name",
	"duplicate-variant",
]);

/** The `number-literal` production. */
const NUMBER_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

/** The vendored suite directory. */
const SUITE_ROOT = new URL("../test/", import.meta.url);

/** State carried by a `:test:*` value from one expression to the next. */
interface TestState {
	input: number;
	decimalPlaces: number;
	failsFormat: boolean;
	failsSelect: boolean;
}

/** The suite's values, keyed by the value object, so a later `:test:*` call can read them. */
const TEST_STATES = new WeakMap<object, TestState>();

/**
 * Builds `:test:function`, `:test:select` or `:test:format` as the suite's README defines
 * them: numeric operand, `decimalPlaces` of 0 or 1, and `fails` to force errors.
 */
function testFunction(kind: "function" | "select" | "format"): MessageFunction {
	return (context, options, input) => {
		let inherited =
			typeof input === "object" && input !== null ? TEST_STATES.get(input) : undefined;
		let state: TestState;
		if (inherited) state = { ...inherited };
		else if (typeof input === "number") {
			state = { input, decimalPlaces: 0, failsFormat: false, failsSelect: false };
		} else if (typeof input === "string" && NUMBER_LITERAL.test(input)) {
			state = { input: Number(input), decimalPlaces: 0, failsFormat: false, failsSelect: false };
		} else throw new MessageError("bad-operand", "Not a number", { source: context.source });

		if ("decimalPlaces" in options) {
			let places = options.decimalPlaces;
			if (places === 0 || places === 1 || places === "0" || places === "1") {
				state.decimalPlaces = Number(places);
			} else throw new MessageError("bad-option", "Bad decimalPlaces", { source: context.source });
		}
		let fails = options.fails;
		if (fails === "always" || fails === "format") state.failsFormat = true;
		if (fails === "always" || fails === "select") state.failsSelect = true;

		let source = context.source;
		let locale = context.locales[0] ?? "und";
		let format = () => {
			if (state.failsFormat) throw new MessageError("bad-option", "Fails format", { source });
			let whole = Math.floor(Math.abs(state.input));
			let text = `${state.input < 0 ? "-" : ""}${whole}`;
			if (state.decimalPlaces === 1) {
				text += `.${Math.floor((Math.abs(state.input) - whole) * 10)}`;
			}
			return text;
		};
		let value: MessageValue = { type: "test", locale, dir: "ltr", source };
		if (kind !== "select") {
			value.toString = format;
			value.toParts = () => [{ type: "test", source, locale, value: format() }];
		}
		if (kind !== "format") {
			value.selectKeys = (keys) => {
				if (state.failsSelect) throw new MessageError("bad-option", "Fails select", { source });
				if (state.input !== 1) return [];
				let matching = state.decimalPlaces === 1 ? ["1.0", "1"] : ["1"];
				return matching.filter((key) => keys.includes(key));
			};
		}
		TEST_STATES.set(value, state);
		return value;
	};
}

/** Custom functions registered for every case. */
const TEST_FUNCTIONS: Record<string, MessageFunction> = {
	"test:function": testFunction("function"),
	"test:select": testFunction("select"),
	"test:format": testFunction("format"),
};

/** Every suite file under `test/`, recursively. */
function suiteFiles(directory: URL): URL[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory()) return suiteFiles(new URL(`${entry.name}/`, directory));
		return entry.name.endsWith(".json") ? [new URL(entry.name, directory)] : [];
	});
}

/** The error name reported for an error the formatter emitted or the constructor threw. */
function errorType(error: unknown) {
	return error instanceof MessageError ? error.type : String(error);
}

/** Runs one case: the constructor must throw for static errors, and format otherwise. */
function run(item: Case) {
	let expectedErrors = (item.expErrors ?? []).map((error) => error.type);
	let options = {
		functions: TEST_FUNCTIONS,
		bidiIsolation: item.bidiIsolation === "none" ? ("none" as const) : ("compatibility" as const),
	};
	if (expectedErrors.some((type) => STATIC_ERRORS.has(type))) {
		let thrown: unknown;
		try {
			new MessageFormat(item.locale, item.src, options);
		} catch (error) {
			thrown = error;
		}
		expect(errorType(thrown)).toBe(expectedErrors[0]);
		return;
	}
	let message = new MessageFormat(item.locale, item.src, options);
	let values = Object.fromEntries((item.params ?? []).map((param) => [param.name, param.value]));
	let errors: string[] = [];
	let output = message.format(values, (error) => errors.push(errorType(error)));
	if (item.exp !== undefined) expect(output).toBe(item.exp);
	expect(errors).toEqual(expectedErrors);
	if (item.expParts) {
		let parts = message.formatToParts(values, () => {});
		expect(parts).toHaveLength(item.expParts.length);
		item.expParts.forEach((expected, index) => expect(parts[index]).toMatchObject(expected));
	}
}

for (let file of suiteFiles(SUITE_ROOT)) {
	let suite = JSON.parse(readFileSync(file, "utf8")) as Suite;
	describe(suite.scenario, () => {
		for (let raw of suite.tests) {
			let item = { ...suite.defaultTestProperties, ...raw } as Case;
			let skipped = UNIMPLEMENTED_FUNCTIONS.some((name) => item.src.includes(name));
			test.skipIf(skipped)(item.description ?? item.src, () => run(item));
		}
	});
}
