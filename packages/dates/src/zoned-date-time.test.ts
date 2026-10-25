/**
 * Tests for RFC 9557 strings: the RFC's own examples, the critical flag, offset and zone
 * disagreements under each policy, the key and zone grammar, and the round trip that lets
 * a zoned instant live in a JSON field or a TEXT column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ZonedDateTimeProblem } from "./invalid-zoned-date-time-error.js";
import type { ParseZonedDateTimeOptions, ZonedDateTime } from "./zoned-date-time.js";

import { InvalidZonedDateTimeError } from "./invalid-zoned-date-time-error.js";
import { formatZonedDateTime, parseZonedDateTime } from "./zoned-date-time.js";

/**
 * The problem a rejected string reports, or `"accepted"` when it parses, so a table of
 * cases reads as input and expected outcome.
 *
 * @param text - Candidate IXDTF string.
 * @param options - Parser options.
 * @returns The failure's problem or `"accepted"`.
 */
function outcome(
	text: string,
	options?: ParseZonedDateTimeOptions,
): ZonedDateTimeProblem | "accepted" {
	let result = parseZonedDateTime(text, options);
	if (isSuccess(result)) return "accepted";
	return result.error.problem;
}

describe("parseZonedDateTime", () => {
	test("reads the RFC 9557 Figure 4 timestamp with no suffix", () => {
		expect(unwrap(parseZonedDateTime("1996-12-19T16:39:57-08:00"))).toEqual({
			date: new Date("1996-12-20T00:39:57Z"),
			offset: -480,
			timeZone: null,
			calendar: null,
			tags: [],
		});
	});

	test("reads the Figure 5 time zone name", () => {
		let value = unwrap(parseZonedDateTime("1996-12-19T16:39:57-08:00[America/Los_Angeles]"));
		expect(value.date.toISOString()).toBe("1996-12-20T00:39:57.000Z");
		expect(value.timeZone).toBe("America/Los_Angeles");
	});

	test("reads the Figure 6 calendar tag", () => {
		let value = unwrap(
			parseZonedDateTime("1996-12-19T16:39:57-08:00[America/Los_Angeles][u-ca=hebrew]"),
		);
		expect(value.calendar).toBe("hebrew");
		expect(value.tags).toEqual([]);
	});

	test("reads a zone that agrees with the offset", () => {
		expect(unwrap(parseZonedDateTime("2026-10-24T10:00:00-03:00[America/Montevideo]"))).toEqual({
			date: new Date("2026-10-24T13:00:00Z"),
			offset: -180,
			timeZone: "America/Montevideo",
			calendar: null,
			tags: [],
		});
	});

	test("keeps fractional seconds to the millisecond, truncating finer digits", () => {
		expect(unwrap(parseZonedDateTime("2026-10-24T10:00:00.5Z")).date.getTime()).toBe(
			Date.UTC(2026, 9, 24, 10, 0, 0, 500),
		);
		expect(unwrap(parseZonedDateTime("2026-10-24T10:00:00.123999Z")).date.getTime()).toBe(
			Date.UTC(2026, 9, 24, 10, 0, 0, 123),
		);
	});

	test("accepts lowercase t and z as RFC 3339 allows", () => {
		expect(unwrap(parseZonedDateTime("2026-10-24t10:00:00z")).date.toISOString()).toBe(
			"2026-10-24T10:00:00.000Z",
		);
	});

	describe("Z and -00:00", () => {
		test("reads Z as an unknown local offset", () => {
			expect(unwrap(parseZonedDateTime("2022-07-08T00:14:07Z")).offset).toBeNull();
		});

		test("reads -00:00 the same as Z, and +00:00 as a known zero offset", () => {
			expect(unwrap(parseZonedDateTime("2022-07-08T00:14:07-00:00")).offset).toBeNull();
			expect(unwrap(parseZonedDateTime("2022-07-08T00:14:07+00:00")).offset).toBe(0);
		});

		test("never finds Z inconsistent with a zone (Figure 2)", () => {
			for (let text of [
				"2022-07-08T00:14:07Z[!Europe/London]",
				"2022-07-08T00:14:07Z[Europe/London]",
				"2022-07-08T00:14:07Z[Europe/Paris]",
				"2022-07-08T00:14:07-00:00[!Europe/Paris]",
			]) {
				expect(outcome(text)).toBe("accepted");
			}
			let value = unwrap(parseZonedDateTime("2022-07-08T00:14:07Z[Europe/Paris]"));
			expect(value.date.toISOString()).toBe("2022-07-08T00:14:07.000Z");
			expect(value.offset).toBeNull();
			expect(value.timeZone).toBe("Europe/Paris");
		});
	});

	describe("offset and zone disagreement", () => {
		test("rejects a critical zone that disagrees with the offset (Figure 1)", () => {
			for (let policy of ["reject", "keepInstant", "keepWallClock"] as const) {
				expect(
					outcome("2022-07-08T00:14:07+00:00[!Europe/London]", { onInconsistentOffset: policy }),
				).toBe("inconsistent");
				expect(
					outcome("2022-07-08T00:14:07+01:00[!Europe/Paris]", { onInconsistentOffset: policy }),
				).toBe("inconsistent");
			}
		});

		test("rejects an elective disagreement by default", () => {
			expect(outcome("2022-07-08T00:14:07+00:00[Europe/London]")).toBe("inconsistent");
			expect(outcome("2022-07-08T00:14:07+01:00[Europe/Paris]")).toBe("inconsistent");
		});

		test("keepInstant keeps the instant and adopts the zone's offset", () => {
			let value = unwrap(
				parseZonedDateTime("2022-07-08T00:14:07+00:00[Europe/London]", {
					onInconsistentOffset: "keepInstant",
				}),
			);
			expect(value.date.toISOString()).toBe("2022-07-08T00:14:07.000Z");
			expect(value.offset).toBe(60);
			expect(formatZonedDateTime(value)).toBe("2022-07-08T01:14:07+01:00[Europe/London]");
		});

		test("keepWallClock keeps the local time and moves the instant", () => {
			let value = unwrap(
				parseZonedDateTime("2022-07-08T00:14:07+00:00[Europe/London]", {
					onInconsistentOffset: "keepWallClock",
				}),
			);
			expect(value.date.toISOString()).toBe("2022-07-07T23:14:07.000Z");
			expect(value.offset).toBe(60);
			expect(formatZonedDateTime(value)).toBe("2022-07-08T00:14:07+01:00[Europe/London]");
		});

		test("checks an offset zone against the offset it repeats", () => {
			expect(outcome("2022-07-08T00:14:07+08:45[+08:45]")).toBe("accepted");
			expect(outcome("2022-07-08T00:14:07+08:00[+08:45]")).toBe("inconsistent");
			expect(outcome("2022-07-08T00:14:07+08:00[!+08:45]")).toBe("inconsistent");
			let value = unwrap(
				parseZonedDateTime("2022-07-08T00:14:07+08:00[+08:45]", {
					onInconsistentOffset: "keepWallClock",
				}),
			);
			expect(value.offset).toBe(525);
			expect(formatZonedDateTime(value)).toBe("2022-07-08T00:14:07+08:45[+08:45]");
		});
	});

	describe("critical and elective tags", () => {
		test("keeps an unknown elective tag", () => {
			expect(unwrap(parseZonedDateTime("2022-07-08T00:14:07+01:00[knort=blargel]")).tags).toEqual([
				{ key: "knort", value: "blargel", critical: false },
			]);
		});

		test("rejects an unknown critical tag", () => {
			expect(outcome("2022-07-08T00:14:07Z[!knort=blargel]")).toBe("unsupportedCritical");
		});

		test("accepts a critical tag whose key the application lists", () => {
			let value = unwrap(
				parseZonedDateTime("2022-07-08T00:14:07Z[!knort=blargel]", { keys: ["knort"] }),
			);
			expect(value.tags).toEqual([{ key: "knort", value: "blargel", critical: true }]);
		});

		test("rejects a critical calendar the runtime cannot use and keeps an elective one", () => {
			expect(outcome("2022-07-08T00:14:07Z[!u-ca=klingon]")).toBe("unsupportedCritical");
			expect(outcome("2022-07-08T00:14:07Z[!u-ca=islamic-umalqura]")).toBe("accepted");
			expect(unwrap(parseZonedDateTime("2022-07-08T00:14:07Z[u-ca=klingon]")).calendar).toBe(
				"klingon",
			);
		});

		test("rejects a duplicate key with a different value when either copy is critical", () => {
			expect(outcome("2022-07-08T00:14:07Z[!u-ca=chinese][u-ca=japanese]")).toBe("inconsistent");
			expect(outcome("2022-07-08T00:14:07Z[u-ca=chinese][!u-ca=japanese]")).toBe("inconsistent");
			expect(outcome("2022-07-08T00:14:07Z[!u-ca=chinese][u-ca=chinese]")).toBe("accepted");
		});

		test("keeps the first of elective duplicates", () => {
			let first = unwrap(parseZonedDateTime("2022-07-08T00:14:07Z[u-ca=chinese][u-ca=japanese]"));
			let only = unwrap(parseZonedDateTime("2022-07-08T00:14:07Z[u-ca=chinese]"));
			expect(first).toEqual(only);
			expect(
				unwrap(parseZonedDateTime("2022-07-08T00:14:07Z[a=one][b=two][a=three]")).tags,
			).toEqual([
				{ key: "a", value: "one", critical: false },
				{ key: "b", value: "two", critical: false },
			]);
		});

		test("rejects experimental keys unless the application lists them (Figure 7)", () => {
			let text = "1996-12-19T16:39:57-08:00[_foo=bar][_baz=bat]";
			expect(outcome(text)).toBe("experimentalKey");
			expect(outcome(text, { keys: ["_foo"] })).toBe("experimentalKey");
			expect(unwrap(parseZonedDateTime(text, { keys: ["_foo", "_baz"] })).tags).toEqual([
				{ key: "_foo", value: "bar", critical: false },
				{ key: "_baz", value: "bat", critical: false },
			]);
		});
	});

	describe("time zones", () => {
		test("fails on a well-formed zone name the runtime does not know", () => {
			expect(outcome("2022-07-08T00:14:07Z[Mars/Olympus_Mons]")).toBe("unknownTimeZone");
			expect(outcome("2022-07-08T00:14:07Z[!Mars/Olympus_Mons]")).toBe("unknownTimeZone");
		});

		test("leaves zone part length to the zone database", () => {
			expect(outcome("2022-07-08T00:14:07Z[America/Argentina/ComodRivadavia]")).toBe("accepted");
			expect(outcome("2022-07-08T00:14:07Z[Abcdefghijklmnopqrstuvwxyz/Abcdefghijklmnop]")).toBe(
				"unknownTimeZone",
			);
		});

		test("rejects a second zone and a zone after a tag", () => {
			expect(outcome("2022-07-08T00:14:07Z[Europe/Paris][Europe/London]")).toBe("syntax");
			expect(outcome("2022-07-08T00:14:07Z[u-ca=hebrew][Europe/Paris]")).toBe("syntax");
		});
	});

	describe("grammar", () => {
		test.each([
			["", "syntax"],
			["2026-10-24", "syntax"],
			["2026-10-24T10:00Z", "syntax"],
			["2026-10-24 10:00:00Z", "syntax"],
			["2026-10-24T10:00:00", "syntax"],
			["2026-10-24T10:00:00.Z", "syntax"],
			["2026-10-24T10:00:00+0300", "syntax"],
			["2026-10-24T10:00:00+24:00", "syntax"],
			["2026-10-24T10:00:00+03:60", "syntax"],
			[" 2026-10-24T10:00:00Z", "syntax"],
			["2026-10-24T10:00:00Z ", "syntax"],
			["2026-10-24T10:00:00Z[]", "syntax"],
			["2026-10-24T10:00:00Z[!]", "syntax"],
			["2026-10-24T10:00:00Z[Europe/Paris", "syntax"],
			["2026-10-24T10:00:00ZEurope/Paris]", "syntax"],
			["2026-10-24T10:00:00Z[[Europe/Paris]]", "syntax"],
			["2026-10-24T10:00:00Z[!!Europe/Paris]", "syntax"],
			["2026-10-24T10:00:00Z[.]", "syntax"],
			["2026-10-24T10:00:00Z[Europe/..]", "syntax"],
			["2026-10-24T10:00:00Z[Europe//Paris]", "syntax"],
			["2026-10-24T10:00:00Z[/Europe]", "syntax"],
			["2026-10-24T10:00:00Z[1Europe]", "syntax"],
			["2026-10-24T10:00:00Z[Europe Paris]", "syntax"],
			["2026-10-24T10:00:00Z[+8:45]", "syntax"],
			["2026-10-24T10:00:00Z[U-CA=hebrew]", "syntax"],
			["2026-10-24T10:00:00Z[u-Ca=hebrew]", "syntax"],
			["2026-10-24T10:00:00Z[1key=value]", "syntax"],
			["2026-10-24T10:00:00Z[-key=value]", "syntax"],
			["2026-10-24T10:00:00Z[key=]", "syntax"],
			["2026-10-24T10:00:00Z[=value]", "syntax"],
			["2026-10-24T10:00:00Z[key=a--b]", "syntax"],
			["2026-10-24T10:00:00Z[key=-a]", "syntax"],
			["2026-10-24T10:00:00Z[key=a_b]", "syntax"],
			["2026-10-24T10:00:00Z[key=a=b]", "syntax"],
			["2026-10-24T10:00:00Z[key=valué]", "syntax"],
			["2026-02-30T10:00:00Z", "invalidDate"],
			["2026-13-01T10:00:00Z", "invalidDate"],
			["2026-10-00T10:00:00Z", "invalidDate"],
			["2026-10-24T24:00:00Z", "invalidDate"],
			["2026-10-24T10:60:00Z", "invalidDate"],
			["2016-12-31T23:59:60Z", "invalidDate"],
		] as const)("%j fails with %s", (text, problem) => {
			let result = parseZonedDateTime(text);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(InvalidZonedDateTimeError);
				expect(result.error.problem).toBe(problem);
				expect(result.error.text).toBe(text);
			}
		});

		test.each([
			"2026-10-24T10:00:00Z[key=a-B-3]",
			"2026-10-24T10:00:00Z[k_e-y9=Value]",
			"2026-10-24T10:00:00Z[America/Port-au-Prince]",
			"2026-10-24T10:00:00Z[Etc/GMT+3]",
			"2024-02-29T10:00:00Z",
			"0001-01-01T00:00:00Z",
		])("%j parses", (text) => {
			expect(outcome(text)).toBe("accepted");
		});
	});
});

describe("formatZonedDateTime", () => {
	test("writes the zone's offset at the instant when none is given", () => {
		expect(
			formatZonedDateTime({
				date: new Date("2026-10-24T13:00:00Z"),
				timeZone: "America/Montevideo",
			}),
		).toBe("2026-10-24T10:00:00-03:00[America/Montevideo]");
		expect(
			formatZonedDateTime({ date: new Date("2026-01-15T12:00:00Z"), timeZone: "Europe/Paris" }),
		).toBe("2026-01-15T13:00:00+01:00[Europe/Paris]");
		expect(
			formatZonedDateTime({ date: new Date("2026-07-15T12:00:00Z"), timeZone: "Europe/Paris" }),
		).toBe("2026-07-15T14:00:00+02:00[Europe/Paris]");
	});

	test("writes Z with no zone, and +00:00 for a known zero offset", () => {
		expect(formatZonedDateTime({ date: new Date("2026-10-24T13:00:00Z") })).toBe(
			"2026-10-24T13:00:00Z",
		);
		expect(formatZonedDateTime({ date: new Date("2026-10-24T13:00:00Z"), offset: 0 })).toBe(
			"2026-10-24T13:00:00+00:00",
		);
		expect(
			formatZonedDateTime({
				date: new Date("2026-10-24T13:00:00Z"),
				offset: null,
				timeZone: "Europe/Paris",
			}),
		).toBe("2026-10-24T13:00:00Z[Europe/Paris]");
	});

	test("writes Z when the zone's offset has seconds RFC 3339 cannot write", () => {
		let text = formatZonedDateTime({
			date: new Date("1960-01-01T12:00:00Z"),
			timeZone: "Africa/Monrovia",
		});
		expect(text).toBe("1960-01-01T12:00:00Z[Africa/Monrovia]");
		expect(outcome(text)).toBe("accepted");
	});

	test("writes milliseconds only when the instant has them", () => {
		expect(formatZonedDateTime({ date: new Date("2026-10-24T13:00:00.050Z") })).toBe(
			"2026-10-24T13:00:00.050Z",
		);
	});

	test("writes the calendar and tags after the zone, and the critical flag when asked", () => {
		expect(
			formatZonedDateTime(
				{
					date: new Date("1996-12-20T00:39:57Z"),
					timeZone: "America/Los_Angeles",
					calendar: "hebrew",
					tags: [{ key: "knort", value: "blargel", critical: false }],
				},
				{ critical: true },
			),
		).toBe("1996-12-19T16:39:57-08:00[!America/Los_Angeles][!u-ca=hebrew][knort=blargel]");
	});

	test("writes years 0-99 literally", () => {
		expect(formatZonedDateTime({ date: new Date("0001-01-01T00:00:00Z") })).toBe(
			"0001-01-01T00:00:00Z",
		);
	});
});

describe("round trip", () => {
	test.each([
		"2026-10-24T10:00:00-03:00[America/Montevideo]",
		"1996-12-19T16:39:57-08:00[America/Los_Angeles][u-ca=hebrew]",
		"2022-07-08T00:14:07Z[Europe/Paris]",
		"2022-07-08T00:14:07+08:45[+08:45]",
		"2022-07-08T00:14:07+00:00",
		"2022-07-08T00:14:07.123+05:30[Asia/Kolkata][u-ca=indian][x-y=Abc-1]",
		"2026-03-08T01:30:00-05:00[America/New_York]",
		"2026-11-01T01:30:00-04:00[America/New_York]",
		"2026-11-01T01:30:00-05:00[America/New_York]",
	])("format(parse(%j)) gives the string back", (text) => {
		expect(formatZonedDateTime(unwrap(parseZonedDateTime(text)))).toBe(text);
	});

	test("both readings of a repeated hour survive a round trip", () => {
		let earlier = unwrap(parseZonedDateTime("2026-11-01T01:30:00-04:00[America/New_York]"));
		let later = unwrap(parseZonedDateTime("2026-11-01T01:30:00-05:00[America/New_York]"));
		expect(later.date.getTime() - earlier.date.getTime()).toBe(3_600_000);
	});

	test("parse(format(value)) equals the value through JSON", () => {
		let value: ZonedDateTime = {
			date: new Date("2026-10-24T13:00:00.250Z"),
			offset: -180,
			timeZone: "America/Montevideo",
			calendar: "gregory",
			tags: [{ key: "knort", value: "blargel", critical: false }],
		};
		let stored = JSON.parse(JSON.stringify({ startsAt: formatZonedDateTime(value) })) as {
			startsAt: string;
		};
		expect(unwrap(parseZonedDateTime(stored.startsAt))).toEqual(value);
	});

	test("a critical tag the application lists survives a round trip", () => {
		let text = "2026-10-24T10:00:00-03:00[America/Montevideo][!_room=B12]";
		let value = unwrap(parseZonedDateTime(text, { keys: ["_room"] }));
		expect(formatZonedDateTime(value)).toBe(text);
	});
});
