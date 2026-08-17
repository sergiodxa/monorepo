/**
 * Tests for the parse failure: that it keeps the rejected text, the reason, the
 * field, and the index as data an app can translate, and that its message stays
 * diagnostic rather than becoming the wording a user reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { InvalidCronExpression } from "./invalid-cron-expression";

describe("InvalidCronExpression", () => {
	test("is an error that can be returned inside a failure", () => {
		let error = new InvalidCronExpression({
			expression: "0 0 * * 8",
			reason: "out-of-range",
			field: "dayOfWeek",
			position: 8,
		});

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("InvalidCronExpression");
	});

	test("keeps everything a validation message needs as data", () => {
		let error = new InvalidCronExpression({
			expression: "  0 0 * * 8",
			reason: "out-of-range",
			field: "dayOfWeek",
			position: 10,
		});

		expect(error.expression).toBe("  0 0 * * 8");
		expect(error.reason).toBe("out-of-range");
		expect(error.field).toBe("dayOfWeek");
		expect(error.position).toBe(10);
	});

	test("names the field in its message when the problem belongs to one", () => {
		let error = new InvalidCronExpression({
			expression: "0 60 * * *",
			reason: "out-of-range",
			field: "hour",
			position: 2,
		});

		expect(error.message).toBe(
			'Invalid cron expression "0 60 * * *": out-of-range in the hour field at position 2',
		);
	});

	test("leaves the field out when the whole expression is at fault", () => {
		let error = new InvalidCronExpression({
			expression: "* * * * * *",
			reason: "seconds-not-supported",
			field: null,
			position: 0,
		});

		expect(error.message).toBe(
			'Invalid cron expression "* * * * * *": seconds-not-supported at position 0',
		);
	});

	test("quotes the text, so whitespace and empty input stay visible", () => {
		let error = new InvalidCronExpression({
			expression: "   ",
			reason: "empty",
			field: null,
			position: 0,
		});

		expect(error.message).toContain('"   "');
	});
});
