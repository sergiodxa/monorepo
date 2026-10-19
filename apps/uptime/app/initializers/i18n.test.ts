/**
 * Tests the translator the email registry and the background send paths use: it resolves a
 * shipped language, reports the language it actually resolved to, and reuses one instance
 * across repeated calls so an outage fanning out to a team's alerts builds a translator once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { FALLBACK_LANGUAGE, translate } from "~/app/initializers/i18n";

describe("translate", () => {
	test("defaults to the app's fallback language", async () => {
		let { locale, t } = translate();

		expect(locale).toBe(FALLBACK_LANGUAGE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("translates through a language the app ships", async () => {
		let { locale, t } = translate("ja");

		expect(locale).toBe("ja");
		expect(t("emails.teamInvite.action")).not.toBe("Accept invite");
	});

	test("falls back for a language the app does not ship, and says so", async () => {
		let { locale, t } = translate("xx");

		expect(locale).toBe(FALLBACK_LANGUAGE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("reuses one translator per language", async () => {
		let first = translate("fr");
		let second = translate("fr");

		expect(first.t).toBe(second.t);
	});
});
