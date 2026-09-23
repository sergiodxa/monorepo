/**
 * Tests the translator factory the background send paths use: it resolves a
 * shipped language, reports the language it actually resolved to, and reuses
 * one instance across repeated calls so an outage fanning out to a team's
 * alerts builds a translator only once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { DEFAULT_EMAIL_LOCALE, emailTranslator } from "~/app/emails/locale";

describe("emailTranslator", () => {
	test("defaults to the app's fallback language", async () => {
		let { locale, t } = emailTranslator();

		expect(locale).toBe(DEFAULT_EMAIL_LOCALE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("translates through a language the app ships", async () => {
		let { locale, t } = emailTranslator("ja");

		expect(locale).toBe("ja");
		expect(t("emails.teamInvite.action")).not.toBe("Accept invite");
	});

	test("falls back for a language the app does not ship, and says so", async () => {
		let { locale, t } = emailTranslator("xx");

		expect(locale).toBe(DEFAULT_EMAIL_LOCALE);
		expect(t("emails.teamInvite.action")).toBe("Accept invite");
	});

	test("reuses one translator per language", async () => {
		let first = emailTranslator("fr");
		let second = emailTranslator("fr");

		expect(first.t).toBe(second.t);
	});
});
