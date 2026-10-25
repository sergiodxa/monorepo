/**
 * Tests for `setDeprecation()` and `getDeprecation()`: the exact field syntax RFC 9745
 * and RFC 8594 fix, links merged beside the ones a response already carries, and a
 * reader that drops an unreadable hint instead of failing the response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { getDeprecation, setDeprecation } from "./deprecation.js";

const DEPRECATION = new Date("2023-06-30T23:59:59Z");
const SUNSET = new Date("2024-06-30T23:59:59Z");

describe(setDeprecation, () => {
	test("writes the RFC 9745 sf-date and the RFC 8594 HTTP-date", () => {
		let headers = new Headers();

		let result = setDeprecation(headers, { deprecation: DEPRECATION, sunset: SUNSET });

		expect(isSuccess(result)).toBe(true);
		expect(headers.get("Deprecation")).toBe("@1688169599");
		expect(headers.get("Sunset")).toBe("Sun, 30 Jun 2024 23:59:59 GMT");
	});

	test("truncates milliseconds to whole seconds", () => {
		let headers = new Headers();

		setDeprecation(headers, { deprecation: new Date(1688169599_750) });

		expect(headers.get("Deprecation")).toBe("@1688169599");
	});

	test("appends both link relations beside the links already there", () => {
		let headers = new Headers({ Link: '<https://api.example.com/items?page=2>; rel="next"' });

		setDeprecation(headers, {
			deprecation: DEPRECATION,
			deprecationLink: "https://developer.example.com/deprecation",
			sunsetLink: "https://developer.example.com/sunset",
		});

		expect(headers.get("Link")).toBe(
			'<https://api.example.com/items?page=2>; rel="next", ' +
				'<https://developer.example.com/deprecation>; rel="deprecation", ' +
				'<https://developer.example.com/sunset>; rel="sunset"',
		);
	});

	test("replaces an earlier notice instead of repeating it", () => {
		let headers = new Headers();
		setDeprecation(headers, {
			deprecation: DEPRECATION,
			sunset: SUNSET,
			deprecationLink: "https://developer.example.com/old",
		});

		setDeprecation(headers, { deprecationLink: "https://developer.example.com/new" });

		expect(headers.get("Deprecation")).toBeNull();
		expect(headers.get("Sunset")).toBeNull();
		expect(headers.get("Link")).toBe('<https://developer.example.com/new>; rel="deprecation"');
	});

	test("refuses a sunset earlier than the deprecation and leaves the headers untouched", () => {
		let headers = new Headers({ Link: '<https://example.com/a>; rel="next"' });

		let result = setDeprecation(headers, { deprecation: SUNSET, sunset: DEPRECATION });

		expect(isFailure(result) && result.error.name).toBe("DeprecationNoticeError");
		expect([...headers]).toEqual([["link", '<https://example.com/a>; rel="next"']]);
	});

	test("refuses an invalid date", () => {
		let result = setDeprecation(new Headers(), { deprecation: new Date(Number.NaN) });

		expect(isFailure(result)).toBe(true);
	});
});

describe(getDeprecation, () => {
	test("reads back what setDeprecation wrote", () => {
		let headers = new Headers();
		let notice = {
			deprecation: DEPRECATION,
			sunset: SUNSET,
			deprecationLink: "https://developer.example.com/deprecation",
			sunsetLink: "https://developer.example.com/sunset",
		};
		setDeprecation(headers, notice);

		expect(getDeprecation(headers)).toEqual(notice);
	});

	test("reads the UTC zone spelling RFC 9745's own example uses", () => {
		let headers = new Headers({
			Deprecation: "@1688169599",
			Sunset: "Sun, 30 Jun 2024 23:59:59 UTC",
		});

		expect(getDeprecation(headers)).toEqual({ deprecation: DEPRECATION, sunset: SUNSET });
	});

	test("leaves out a field that is not valid", () => {
		let headers = new Headers({ Deprecation: "true", Sunset: "tomorrow" });

		expect(getDeprecation(headers)).toBeNull();
	});

	test("reads a policy link announced before any date", () => {
		let headers = new Headers({
			Link: '<https://developer.example.com/deprecation>; rel="deprecation"; type="text/html"',
		});

		expect(getDeprecation(headers)).toEqual({
			deprecationLink: "https://developer.example.com/deprecation",
		});
	});

	test("answers null for a response that announces nothing", () => {
		expect(getDeprecation(new Headers({ Link: '<https://example.com/a>; rel="next"' }))).toBeNull();
	});
});
