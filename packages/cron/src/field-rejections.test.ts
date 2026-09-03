/**
 * Exhaustive rejection per field: every value just outside a field's bounds, every
 * reversed range, every broken step, every non-standard extension, and every field
 * count that is not five. Each one is checked for the reason, the field, and the index
 * it reports, because a caret pointing at the wrong character is a silent regression.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { InvalidCronReason } from "./invalid-cron-expression.js";
import type { FieldSpec } from "./test/corpus.js";

import { Schedule } from "./schedule.js";
import {
	CORPUS_SEED,
	CORPUS_SIZE,
	expressionWith,
	FIELD_SPECS,
	MONTH_LENGTHS,
	randomInvalidExpressions,
	specFor,
} from "./test/corpus.js";
import { rejectionOf } from "./test/properties.js";

/** Where a field starts in the expression `expressionWith` builds, minute first. */
const FIELD_OFFSETS = [0, 2, 4, 6, 8];

/**
 * Reject a form placed in its field and check everything the failure reports about it.
 *
 * @param spec - The field the form belongs to.
 * @param form - The field text.
 * @param expected - Reason, and where in the form the index should land.
 */
function expectRejects(
	spec: FieldSpec,
	form: string,
	expected: { reason: InvalidCronReason; inFormAt?: number },
): void {
	let expression = expressionWith(spec, form);
	let offset = FIELD_OFFSETS[spec.index] ?? 0;
	let error = rejectionOf(expression);

	expect({
		form,
		reason: error.reason,
		field: error.field,
		position: error.position,
		expression: error.expression,
	}).toEqual({
		form,
		reason: expected.reason,
		field: spec.field,
		position: offset + (expected.inFormAt ?? 0),
		expression,
	});
}

describe.each(FIELD_SPECS.map((spec) => [spec.field, spec] as const))(
	"values the %s field is out of range for",
	(_name, spec) => {
		test("rejects every value above the field maximum, up to forty past it", () => {
			for (let value = spec.max + 1; value <= spec.max + 40; value++) {
				expectRejects(spec, `${value}`, { reason: "out-of-range" });
			}
		});

		test("rejects every value below the field minimum", () => {
			for (let value = spec.min - 1; value >= 0; value--) {
				expectRejects(spec, `${value}`, { reason: "out-of-range" });
			}
			expectRejects(spec, "-1", { reason: "syntax" });
		});

		test("rejects a value far outside anything a field could hold", () => {
			for (let form of ["100", "999", "1000000", "99999999999999999999"]) {
				expectRejects(spec, form, { reason: "out-of-range" });
			}
		});

		test("rejects an out-of-range value inside a list, pointing at that item", () => {
			let inside = `${spec.min},${spec.max + 1}`;
			expectRejects(spec, inside, {
				reason: "out-of-range",
				inFormAt: `${spec.min}`.length + 1,
			});
		});

		test("rejects an out-of-range end of a range, pointing at the end", () => {
			let form = `${spec.min}-${spec.max + 1}`;
			expectRejects(spec, form, { reason: "out-of-range", inFormAt: `${spec.min}`.length + 1 });
		});

		test("rejects every reversed range", () => {
			for (let start = spec.min + 1; start <= spec.max; start++) {
				for (let end = spec.min; end < start; end++) {
					expectRejects(spec, `${start}-${end}`, { reason: "reversed-range" });
				}
			}
		});

		test("rejects a step that is zero, missing, or not a number", () => {
			for (let form of ["*/0", "*/", "*/x", "*/-2", "*/1.5", "*/+2", "*/ ".trim()]) {
				expectRejects(spec, form, { reason: "invalid-step", inFormAt: 2 });
			}
			expectRejects(spec, `${spec.min}-${spec.max}/0`, {
				reason: "invalid-step",
				inFormAt: `${spec.min}-${spec.max}`.length + 1,
			});
		});

		test("rejects a second step or a second dash rather than reading part of it", () => {
			expectRejects(spec, "*/2/3", { reason: "invalid-step", inFormAt: 3 });
			expectRejects(spec, `${spec.min}-${spec.min}-${spec.min}`, {
				reason: "syntax",
				inFormAt: `${spec.min}`.length * 2 + 1,
			});
		});

		test("rejects text that is not a value, a range, or a step", () => {
			for (let form of ["1.5", "+1", "0x1", "1e2", "1,,2", ",", "-", "1-", "-5", ",5", "5,"]) {
				let error = rejectionOf(expressionWith(spec, form));
				expect({ form, reason: error.reason, field: error.field }).toEqual({
					form,
					reason: "syntax",
					field: spec.field,
				});
			}
		});

		test("rejects the non-standard extensions other parsers accept", () => {
			for (let form of ["L", "l", "W", "1W", "15W", "LW", "1#2", "?", "1L", "*/L"]) {
				let error = rejectionOf(expressionWith(spec, form));
				expect({ form, rejected: true, field: error.field }).toEqual({
					form,
					rejected: true,
					field: spec.field,
				});
			}
		});

		test("rejects a name in a field that has no names, and an unknown one where it does", () => {
			let unknown = spec.names === null ? ["jan", "mon", "abc"] : ["jaan", "sunday", "xyz"];
			for (let form of unknown) {
				expectRejects(spec, form, { reason: "unknown-name" });
			}
		});
	},
);

describe("names belong to the field that knows them", () => {
	test("rejects a month name in the day-of-week field and the other way round", () => {
		for (let [field, form] of [
			["month", "MON"],
			["month", "SUN"],
			["dayOfWeek", "JAN"],
			["dayOfWeek", "DEC"],
		] as const) {
			let spec = specFor(field);
			expectRejects(spec, form, { reason: "unknown-name" });
		}
	});

	test("accepts the abbreviations that are only nearly the same", () => {
		expect(isFailure(Schedule.parse("0 0 * MAR *"))).toBe(false);
		expect(isFailure(Schedule.parse("0 0 * * MON"))).toBe(false);
		expect(isFailure(Schedule.parse("0 0 * MON *"))).toBe(true);
	});
});

describe("how many fields an expression has", () => {
	test("rejects every field count that is not five", () => {
		let counts: Record<number, { reason: InvalidCronReason; position: number }> = {
			0: { reason: "empty", position: 0 },
			1: { reason: "field-count", position: 1 },
			2: { reason: "field-count", position: 3 },
			3: { reason: "field-count", position: 5 },
			4: { reason: "field-count", position: 7 },
			6: { reason: "seconds-not-supported", position: 0 },
			7: { reason: "field-count", position: 10 },
			8: { reason: "field-count", position: 10 },
		};

		for (let [count, expected] of Object.entries(counts)) {
			let expression = Array.from({ length: Number(count) }, () => "*").join(" ");
			let error = rejectionOf(expression);
			expect({ count, reason: error.reason, field: error.field, position: error.position }).toEqual(
				{
					count,
					reason: expected.reason,
					field: null,
					position: expected.position,
				},
			);
		}
	});

	test("rejects six fields as a seconds schedule however they are written", () => {
		for (let expression of ["* * * * * *", "*/5 * * * * *", "0 0 0 9 * 1", "0 0 9 * * MON"]) {
			let error = rejectionOf(expression);
			expect({ expression, reason: error.reason }).toEqual({
				expression,
				reason: "seconds-not-supported",
			});
		}
	});

	test("rejects nothing but whitespace as empty rather than as a field count", () => {
		for (let expression of ["", " ", "\t", "\n", "     ", "\t\n "]) {
			let error = rejectionOf(expression);
			expect({ expression, reason: error.reason, position: error.position }).toEqual({
				expression,
				reason: "empty",
				position: 0,
			});
		}
	});
});

describe("macros the package does not implement", () => {
	test("rejects every shorthand outside the supported set", () => {
		for (let expression of [
			"@reboot",
			"@every_minute",
			"@minutely",
			"@fortnightly",
			"@",
			"@@daily",
			"@daily extra",
			"@daily @daily",
			"@Daily-ish",
		]) {
			let error = rejectionOf(expression);
			expect({ expression, reason: error.reason, field: error.field }).toEqual({
				expression,
				reason: "unknown-macro",
				field: null,
			});
		}
	});

	test("points at the shorthand itself, whatever whitespace precedes it", () => {
		for (let indent of ["", " ", "   ", "\t"]) {
			let expression = `${indent}@reboot`;
			expect({ indent, position: rejectionOf(expression).position }).toEqual({
				indent,
				position: indent.length,
			});
		}
	});
});

describe("dates no calendar contains", () => {
	test("rejects every day-of-month and month pair that cannot occur", () => {
		for (let month = 1; month <= 12; month++) {
			for (let day = 1; day <= 31; day++) {
				let expression = `0 0 ${day} ${month} *`;
				let result = Schedule.parse(expression);
				let reachable = day <= (MONTH_LENGTHS[month] ?? 0);
				expect({ expression, accepted: !isFailure(result) }).toEqual({
					expression,
					accepted: reachable,
				});
				if (!reachable) {
					let error = rejectionOf(expression);
					expect({ expression, reason: error.reason, field: error.field }).toEqual({
						expression,
						reason: "impossible-date",
						field: "dayOfMonth",
					});
				}
			}
		}
	});

	test("accepts an impossible day of month as soon as a weekday can match instead", () => {
		for (let month = 1; month <= 12; month++) {
			for (let day = 1; day <= 31; day++) {
				expect({
					month,
					day,
					accepted: !isFailure(Schedule.parse(`0 0 ${day} ${month} 1`)),
				}).toEqual({ month, day, accepted: true });
			}
		}
	});

	test("rejects a set of months none of which is long enough", () => {
		expect(rejectionOf("0 0 31 2,4,6,9,11 *").reason).toBe("impossible-date");
		expect(rejectionOf("0 0 30 2 *").reason).toBe("impossible-date");
		expect(isFailure(Schedule.parse("0 0 31 2,3 *"))).toBe(false);
	});
});

describe("where a failure says the problem is", () => {
	test("keeps the index aligned with the text as typed, whatever pads it", () => {
		for (let indent of ["", " ", "  ", "\t", "\n  "]) {
			for (let spec of FIELD_SPECS) {
				let fields = ["*", "*", "*", "*", "*"];
				fields[spec.index] = `${spec.max + 1}`;
				let expression = `${indent}${fields.join(" ")}`;
				let error = rejectionOf(expression);
				expect({ indent, field: error.field, position: error.position }).toEqual({
					indent,
					field: spec.field,
					position: indent.length + (FIELD_OFFSETS[spec.index] ?? 0),
				});
			}
		}
	});

	test("keeps the index aligned when the fields before it are wider than one character", () => {
		let expression = "0,15,30 9-17 1,15,31 JAN-JUN 99";
		let error = rejectionOf(expression);
		expect({ field: error.field, position: error.position }).toEqual({
			field: "dayOfWeek",
			position: expression.indexOf("99"),
		});
	});

	test("stops at the first problem, reading the fields left to right", () => {
		let error = rejectionOf("60 25 32 13 8");
		expect({ field: error.field, position: error.position }).toEqual({
			field: "minute",
			position: 0,
		});
	});
});

describe("anything at all as input", () => {
	test("returns a failure rather than throwing, and never points outside the text", () => {
		let corpus = [
			...randomInvalidExpressions({ seed: CORPUS_SEED, count: CORPUS_SIZE }),
			"nonsense",
			"@@@",
			"*".repeat(500),
			"*".repeat(500).split("").join(" "),
			"0 0 * * * ",
			"０ ０ ＊ ＊ ＊",
			"🙂 * * * *",
			"0 0 * * *; DROP TABLE",
			"-".repeat(50),
			",,,,,",
			"/////",
			"0/0/0/0/0",
		];

		for (let expression of corpus) {
			let result = Schedule.parse(expression);
			if (!isFailure(result))
				throw new Error(`unexpected success for ${JSON.stringify(expression)}`);
			let { position, field } = result.error;
			expect({
				expression,
				inBounds: position >= 0 && position <= expression.length,
				knownField: field === null || FIELD_SPECS.some((spec) => spec.field === field),
			}).toEqual({ expression, inBounds: true, knownField: true });
		}
	});

	test("says the same thing about the same input every time", () => {
		for (let expression of ["", "0 0 * * 8", "@reboot", "* * * * * *", "0 0 30 2 *"]) {
			let first = rejectionOf(expression);
			let second = rejectionOf(expression);
			expect({ ...pick(first) }).toEqual({ ...pick(second) });
		}
	});
});

/**
 * The parts of a failure a caller reads, as a plain object for comparison.
 *
 * @param error - The failure.
 * @returns Its reason, field, position, and message.
 */
function pick(error: { reason: string; field: string | null; position: number; message: string }) {
	return {
		reason: error.reason,
		field: error.field,
		position: error.position,
		message: error.message,
	};
}
