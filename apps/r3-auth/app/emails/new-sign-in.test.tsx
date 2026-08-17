/**
 * Tests of the new-sign-in notice on its own: the device classes it has a word for, and
 * what it reports when the platform recorded no address. The paths that send it are
 * covered where they are driven; this file covers the copy those paths cannot vary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "@pkg/mail";
import { describe, expect, test } from "vitest";

import type { DeviceType } from "~/app/http/view-models/account-session";

import { emailTranslator } from "~/app/emails/locale";
import { NewSignInEmail } from "~/app/emails/new-sign-in";

/** Builds the notice for one device class, with everything else held fixed. */
async function renderFor(deviceType: DeviceType, ip: string | null): Promise<string> {
	let { locale, t } = await emailTranslator();

	let email = new NewSignInEmail({
		email: "jane@example.com",
		browser: "Firefox",
		os: "Linux",
		deviceType,
		ip,
		locale,
		t,
	});

	let { text } = await render(email.body());

	return text;
}

describe("the new-sign-in notice", () => {
	test("names every device class in the reader's language", async () => {
		expect(await renderFor("desktop", "203.0.113.7")).toContain("Desktop");
		expect(await renderFor("mobile", "203.0.113.7")).toContain("Phone");
		expect(await renderFor("tablet", "203.0.113.7")).toContain("Tablet");
		expect(await renderFor("unknown", "203.0.113.7")).toContain("Unknown device");
	});

	test("says an address was not recorded rather than dropping the row", async () => {
		let text = await renderFor("desktop", null);

		expect(text).toContain("IP address");
		expect(text).toContain("Not recorded");
	});

	test("renders no locale key, so every string it asks for exists", async () => {
		let text = await renderFor("desktop", "203.0.113.7");

		expect(text).not.toContain("emails.newSignIn");
		expect(text).not.toContain("emails.footer");
	});
});
