/**
 * Unit tests for the `getDayLabel` helper. They assert that a zero-based weekday index
 * maps to the expected short weekday name in English and that the function honors other
 * locales (French, Spanish, German, Italian, Japanese, Chinese, Portuguese). They exist
 * to lock in the Monday-first ordering and locale-aware formatting the heatmap relies on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import getDayLabel from "./get-day-label";

describe(getDayLabel, () => {
	test("returns the correct day label for a given day of the week", () => {
		expect(getDayLabel("en-US", 0)).toBe("Mon");
		expect(getDayLabel("en-US", 1)).toBe("Tue");
		expect(getDayLabel("en-US", 2)).toBe("Wed");
		expect(getDayLabel("en-US", 3)).toBe("Thu");
		expect(getDayLabel("en-US", 4)).toBe("Fri");
		expect(getDayLabel("en-US", 5)).toBe("Sat");
		expect(getDayLabel("en-US", 6)).toBe("Sun");
	});

	test("accepts different locales", () => {
		expect(getDayLabel("fr-FR", 0)).toBe("lun.");
		expect(getDayLabel("es-AR", 1)).toBe("mar");
		expect(getDayLabel("de-DE", 2)).toBe("Mi");
		expect(getDayLabel("it-IT", 3)).toBe("gio");
		expect(getDayLabel("ja-JP", 4)).toBe("金");
		expect(getDayLabel("zh-CN", 5)).toBe("周六");
		expect(getDayLabel("pt-BR", 6)).toBe("dom.");
	});
});
