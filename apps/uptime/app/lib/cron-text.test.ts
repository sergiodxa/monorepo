/**
 * Tests the cron copy helpers against the real locale dictionaries: every descriptor
 * kind reaches a translated sentence, the two shapes that survive as data (an interval
 * of one, and minute zero of every hour) read naturally, and a rejected expression is
 * explained by reason rather than by a hardcoded English string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { InvalidCronReason } from "@pkg/cron";
import type { TFunction } from "i18next";

import { Schedule } from "@pkg/cron";
import { isFailure, unwrap } from "@pkg/result";
import { createInstance } from "i18next";

import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";

import { describeSchedule, invalidCronMessage } from "./cron-text";

const LOCALES = { en, es, de, fr, it, ja };

let i18next = createInstance();
await i18next.init({
	lng: "en",
	fallbackLng: "en",
	supportedLngs: Object.keys(LOCALES),
	resources: Object.fromEntries(
		Object.entries(LOCALES).map(([language, translation]) => [language, { translation }]),
	),
	interpolation: { escapeValue: false },
});

/** The translator for one language, as a controller would hand it to the helpers. */
function translator(language: string): TFunction {
	return i18next.getFixedT(language);
}

/** Describes an expression in one language, the way a controller calls the helper. */
function describeIn(language: string, expression: string): string {
	return describeSchedule(expression, { locale: language, t: translator(language) });
}

describe("describeSchedule", () => {
	test("describes minute and hour intervals, pluralized", () => {
		expect(describeIn("en", "* * * * *")).toBe("Every minute");
		expect(describeIn("en", "*/5 * * * *")).toBe("Every 5 minutes");
		expect(describeIn("en", "*/10 * * * *")).toBe("Every 10 minutes");
		expect(describeIn("en", "0 */6 * * *")).toBe("Every 6 hours");
	});

	test("reads minute zero of every hour as every hour, not as minute 0", () => {
		expect(describeIn("en", "0 * * * *")).toBe("Every hour");
		expect(describeIn("en", "@hourly")).toBe("Every hour");
		expect(describeIn("en", "5 * * * *")).toBe("Every hour at minute 5");
		expect(describeIn("en", "5,35 * * * *")).toBe("Every hour at minute 5 and 35");
	});

	test("describes daily schedules on a 24-hour clock", () => {
		expect(describeIn("en", "0 0 * * *")).toBe("Every day at 00:00");
		expect(describeIn("en", "@daily")).toBe("Every day at 00:00");
		expect(describeIn("en", "30 9 * * *")).toBe("Every day at 09:30");
		expect(describeIn("en", "0 6,18 * * *")).toBe("Every day at 06:00 and 18:00");
	});

	test("names weekdays and months from the locale", () => {
		expect(describeIn("en", "0 9 * * 1")).toBe("Every Monday at 09:00");
		expect(describeIn("en", "0 9 * * 1-5")).toBe(
			"Every Monday, Tuesday, Wednesday, Thursday, and Friday at 09:00",
		);
		expect(describeIn("en", "@weekly")).toBe("Every Sunday at 00:00");
		expect(describeIn("en", "0 0 15 * *")).toBe("Every month on day 15 at 00:00");
		expect(describeIn("en", "0 0 1 1 *")).toBe("Every year on January 1 at 00:00");
	});

	test("falls back to the expression when no concise shape fits", () => {
		// Both day fields restricted: the either-or rule has no one-sentence shape.
		expect(describeIn("en", "0 0 1 1 1")).toBe("Custom schedule (0 0 1 1 1)");
	});

	test("falls back to the expression as typed when it no longer parses", () => {
		expect(describeIn("en", "not-a-cron")).toBe("Custom schedule (not-a-cron)");
	});

	test("translates the same schedule into every supported language", () => {
		expect(describeIn("es", "0 9 * * 1")).toBe("Todos los lunes a las 09:00");
		expect(describeIn("de", "0 9 * * 1")).toBe("Jeden Montag um 09:00");
		expect(describeIn("fr", "0 9 * * 1")).toBe("Chaque lundi à 09:00");
		expect(describeIn("it", "0 9 * * 1")).toBe("Ogni lunedì alle 09:00");
		expect(describeIn("ja", "0 9 * * 1")).toBe("毎週月曜日 09:00");
	});

	test("ships no English to a non-English locale, for every descriptor kind", () => {
		let expressions = [
			"* * * * *",
			"*/5 * * * *",
			"0 */6 * * *",
			"0 * * * *",
			"5 * * * *",
			"0 0 * * *",
			"0 9 * * 1-5",
			"0 0 15 * *",
			"0 0 1 1 *",
		];

		for (let expression of expressions) {
			for (let language of ["es", "de", "fr", "it", "ja"]) {
				expect(describeIn(language, expression)).not.toBe(describeIn("en", expression));
			}
		}
	});

	test("every expression the parser accepts reaches a translated sentence", () => {
		// A descriptor kind with no key would surface the key itself.
		for (let expression of ["* * * * *", "0 * * * *", "0 0 * * *", "0 0 * * 0", "0 0 1 1 *"]) {
			for (let language of Object.keys(LOCALES)) {
				expect(describeIn(language, expression)).not.toContain("schedule.");
			}
		}
	});
});

describe("invalidCronMessage", () => {
	test("explains each reason the parser rejects an expression", () => {
		let cases: Array<[string, InvalidCronReason]> = [
			["", "empty"],
			["0 0 * *", "field-count"],
			["0 0 0 * * *", "seconds-not-supported"],
			["@fortnightly", "unknown-macro"],
			["0 0 * * 1,9", "out-of-range"],
			["0 0 * * FOO", "unknown-name"],
			["0 17-9 * * *", "reversed-range"],
			["*/0 * * * *", "invalid-step"],
			["0 0 30 2 *", "impossible-date"],
			["0 0 * * ~", "syntax"],
		];

		for (let [expression, reason] of cases) {
			let result = Schedule.parse(expression);
			if (!isFailure(result)) throw new Error(`${expression} unexpectedly parsed`);
			expect(result.error.reason).toBe(reason);

			for (let language of Object.keys(LOCALES)) {
				let message = invalidCronMessage(result.error, translator(language));
				expect(message).not.toBe(`cron.error.${reason}`);
				expect(message.length).toBeGreaterThan(0);
			}
		}
	});
});

describe("the schedules stored in production", () => {
	test("all describe without falling back to the expression", () => {
		let stored = [
			"0 0 * * *",
			"* * * * *",
			"*/10 * * * *",
			"*/5 * * * *",
			"0 * * * *",
			"0 1 * * *",
			"0 6 * * *",
		];

		for (let expression of stored) {
			expect(unwrap(Schedule.parse(expression)).describe().kind).not.toBe("expression");
			expect(describeIn("en", expression)).not.toContain(expression);
		}
	});
});
