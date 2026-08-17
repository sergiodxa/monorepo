/**
 * Exhaustive acceptance per field: every single value, every contiguous range, every
 * step on a star, a spread of steps on ranges and values, and every abbreviation in
 * every case. Each one is expanded independently from the grammar and compared with
 * what the parser produced, then held to normalization and descriptor coverage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isSuccess, unwrap } from "@pkg/result";

import type { FieldSpec } from "./test/corpus";

import { parseExpression } from "./parse-expression";
import { Schedule } from "./schedule";
import {
	everyFormOf,
	expectedValues,
	expressionWith,
	FIELD_SPECS,
	formsFor,
	MACROS,
	specFor,
	valuesOf,
} from "./test/corpus";
import { expectDescriptorShape, expectStableNormalization } from "./test/properties";

/**
 * Expand a form through the package and compare it with the values the grammar says it
 * stands for. Both sides are wrapped with the form so a failure prints which one broke.
 *
 * @param spec - The field the form belongs to.
 * @param form - The field text.
 */
function expectExpandsCorrectly(spec: FieldSpec, form: string): void {
	let expression = expressionWith(spec, form);
	let parsed = parseExpression(expression);
	if (!isSuccess(parsed)) throw new Error(`unexpected failure for ${expression}`);
	expect({ form, values: [...valuesOf(parsed.data, spec)] }).toEqual({
		form,
		values: expectedValues(spec, form),
	});
}

describe.each(FIELD_SPECS.map((spec) => [spec.field, spec] as const))(
	"every form the %s field accepts",
	(_name, spec) => {
		let forms = formsFor(spec);

		test(`expands each of the ${forms.singles.length} single values`, () => {
			for (let form of forms.singles) expectExpandsCorrectly(spec, form);
		});

		test(`expands each of the ${forms.ranges.length} contiguous ranges`, () => {
			for (let form of forms.ranges) expectExpandsCorrectly(spec, form);
		});

		test(`expands a star with each of the ${forms.starSteps.length} possible steps`, () => {
			for (let form of forms.starSteps) expectExpandsCorrectly(spec, form);
		});

		test(`expands each of the ${forms.rangeSteps.length} ranges written with a step`, () => {
			for (let form of forms.rangeSteps) expectExpandsCorrectly(spec, form);
		});

		test(`expands each of the ${forms.valueSteps.length} single values written with a step`, () => {
			// A step on a single value runs from it to the field maximum, which is how
			// "5/10" reaches every tenth minute from the fifth rather than meaning only 5.
			for (let form of forms.valueSteps) expectExpandsCorrectly(spec, form);
		});

		test("expands every abbreviation it knows, in any case", () => {
			for (let form of [...forms.names, ...forms.nameRanges]) expectExpandsCorrectly(spec, form);
			if (spec.names === null) expect(forms.names).toEqual([]);
		});

		test("expands every two-value list, sorted and deduplicated", () => {
			// Overlapping items are the case a list has to fold rather than repeat, and the
			// pair covers it exhaustively: every ordering and every collision.
			for (let first = spec.min; first <= spec.max; first++) {
				for (let second = spec.min; second <= spec.max; second++) {
					expectExpandsCorrectly(spec, `${first},${second}`);
				}
			}
		});

		test("normalizes every form back to itself", () => {
			for (let form of everyFormOf(spec)) expectStableNormalization(expressionWith(spec, form));
		});

		test("describes every form with the shape its fields call for", () => {
			for (let form of everyFormOf(spec)) expectDescriptorShape(expressionWith(spec, form));
		});
	},
);

describe("the day-of-week seven alias", () => {
	test("reads seven as Sunday wherever it appears", () => {
		let spec = specFor("dayOfWeek");
		for (let form of ["7", "0-7", "5-7", "7-7", "*/7", "6,7", "7/1", "SUN-SAT", "0,7"]) {
			expectExpandsCorrectly(spec, form);
		}
		expect(expectedValues(spec, "7")).toEqual([0]);
		expect(expectedValues(spec, "0-7")).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	test("is the only field where a value above the maximum folds instead of failing", () => {
		for (let spec of FIELD_SPECS) {
			let result = Schedule.parse(expressionWith(spec, `${spec.limit + 1}`));
			expect({ field: spec.field, accepted: isSuccess(result) }).toEqual({
				field: spec.field,
				accepted: spec.field === "dayOfWeek",
			});
		}
	});
});

describe("macros", () => {
	test("every macro parses to the expression it stands for", () => {
		for (let { macro, expands } of MACROS) {
			expect({ macro, fields: parseExpression(macro) }).toEqual({
				macro,
				fields: parseExpression(expands),
			});
		}
	});

	test("every macro reads whatever case it is written in", () => {
		for (let { macro, expands } of MACROS) {
			for (let written of [macro.toUpperCase(), `@${macro[1]?.toUpperCase()}${macro.slice(2)}`]) {
				expect({ written, fields: parseExpression(written) }).toEqual({
					written,
					fields: parseExpression(expands),
				});
			}
		}
	});

	test("every macro normalizes to the same text as the expression it stands for", () => {
		for (let { macro, expands } of MACROS) {
			expectStableNormalization(macro);
			expect({ macro, normalized: unwrap(Schedule.parse(macro)).toString() }).toEqual({
				macro,
				normalized: unwrap(Schedule.parse(expands)).toString(),
			});
		}
	});

	test("every macro has a descriptor rather than falling back to its text", () => {
		for (let { macro } of MACROS) expectDescriptorShape(macro);
	});
});

describe("whitespace between fields", () => {
	test("any run of whitespace separates two fields", () => {
		// A non-breaking space counts, because a field is a run of non-whitespace and the
		// runtime's idea of whitespace includes it. An expression pasted out of a document
		// therefore still parses rather than failing on a character nobody can see.
		for (let separator of [" ", "  ", "\t", "\n", "\r", "\u00a0", " \t "]) {
			let expression = ["0", "9", "*", "*", "1-5"].join(separator);
			expect({ separator, fields: parseExpression(expression) }).toEqual({
				separator,
				fields: parseExpression("0 9 * * 1-5"),
			});
		}
	});

	test("leading and trailing whitespace is not a field", () => {
		expect(parseExpression("  0 9 * * 1-5  ")).toEqual(parseExpression("0 9 * * 1-5"));
	});
});

describe("values a number would accept but the grammar does not", () => {
	test("reads leading zeros as the number they spell", () => {
		// Digits only, so "00" is zero and "007" is seven, while "+7" and "7.0" are not
		// values at all. A stored expression that grew a zero must not change meaning.
		expect(expectedValues(specFor("minute"), "00")).toEqual([0]);
		for (let form of ["00", "007", "0000009"]) {
			expectExpandsCorrectly(specFor("hour"), form);
		}
	});
});
