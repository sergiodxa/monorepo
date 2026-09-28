/**
 * The try-it form's honeypot for tests: one instance a router installs the way `bootstrap/app.tsx`
 * does, with the controller deciding every failure, and a reader for the fields a rendered page
 * carries, so a test posts them exactly as a browser would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";

/** Signs and verifies every test token; a forged one is anything this key did not sign. */
export const TEST_HONEYPOT = new Honeypot({ secret: "honeypot:test-cookie-secret" });

/** The middleware as the app installs it: every failure reaches the controller. */
export function testHoneypot(): Middleware {
	return honeypot(TEST_HONEYPOT, { onFailure: () => null });
}

/**
 * The honeypot fields a rendered form carries, read from its HTML as a browser would post them.
 *
 * @param html - A rendered page holding exactly one form's fields.
 * @returns The token field's name and value, and the trap's name.
 * @throws When the page rendered no honeypot fields, so the test fails where the fields are missing.
 */
export function honeypotFields(html: string) {
	let token = html.match(/<input type="hidden" name="(hp-token)" value="([^"]+)"/);
	let trap = html.match(/<input type="text" id="(hp_[a-z]+)"/);
	if (!token?.[1] || !token[2] || !trap?.[1])
		throw new Error("the page rendered no honeypot fields");
	return { tokenField: token[1], token: token[2], trapField: trap[1] };
}
