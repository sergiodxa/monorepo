/**
 * Tests the translator factory the background send paths use: it resolves a shipped
 * language, reports back the language it actually produced rather than the one it was
 * asked for, and hands out the same instance twice so an outage fanning out to a
 * team's alerts does not rebuild i18next per email.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { DEFAULT_EMAIL_LOCALE, emailTranslator } from "~/app/emails/locale";

describe("emailTranslator", () => {
	test("defaults to the app's fallback language", async () => {
		let { locale, t } = await emailTranslator();

		expect(locale).toBe(DEFAULT_EMAIL_LOCALE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("translates through a language the app ships", async () => {
		let { locale, t } = await emailTranslator("ja");

		expect(locale).toBe("ja");
		expect(t("emails.teamInvite.action")).not.toBe("Accept invite");
	});

	test("falls back for a language the app does not ship, and says so", async () => {
		let { locale, t } = await emailTranslator("xx");

		expect(locale).toBe(DEFAULT_EMAIL_LOCALE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("reuses one translator per language", async () => {
		let first = await emailTranslator("fr");
		let second = await emailTranslator("fr");

		expect(first.t).toBe(second.t);
	});
});
