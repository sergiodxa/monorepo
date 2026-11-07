/**
 * Tests how a page's language is picked from `?lang=` and `Accept-Language`, for the blog's
 * bilingual pages and for a page with its own languages, such as an app's three.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { resolveLocale, resolvePageLocale } from "~/app/services/page-locale";

/** The languages of a page written in English, Argentine Spanish and Japanese. */
const THREE = ["en", "es-AR", "ja"] as const;

describe("resolvePageLocale", () => {
	test("keeps a Japanese reader on English, the bilingual pages' fallback", () => {
		expect(resolvePageLocale(new URL("https://sergiodxa.com/press"), "ja-JP")).toBe("en");
	});
});

describe("resolveLocale", () => {
	test("matches a regional tag to the page's language on its base tag", () => {
		let url = new URL("https://sergiodxa.com/apps/encore");

		expect(resolveLocale(url, "ja-JP,en;q=0.5", THREE)).toBe("ja");
		expect(resolveLocale(url, "es-419", THREE)).toBe("es-AR");
	});

	test("lets ?lang= win over the header, and ignores one the page lacks", () => {
		expect(resolveLocale(new URL("https://sergiodxa.com/x?lang=ja"), "es", THREE)).toBe("ja");
		expect(resolveLocale(new URL("https://sergiodxa.com/x?lang=fr"), "es", THREE)).toBe("es-AR");
	});

	test("falls back to the page's first language", () => {
		expect(resolveLocale(new URL("https://sergiodxa.com/x"), "de-DE", THREE)).toBe("en");
		expect(resolveLocale(new URL("https://sergiodxa.com/x"), null, THREE)).toBe("en");
	});
});
