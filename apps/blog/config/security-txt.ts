/**
 * The site's RFC 9116 security.txt: where a researcher reports a vulnerability found on
 * the apex domain, which is where one looks when no subdomain answers. Served by the
 * `wellKnown()` middleware at `/.well-known/security.txt`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { PROFILE } from "~/config/profile";

/**
 * The file's fields. `expires` is a literal date so a person reviews the contact at least
 * once a year; `security-txt.test.ts` starts failing 30 days before it passes.
 */
export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:hello+security@sergiodxa.com")],
	expires: new Date("2027-09-26T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en", "es"],
	canonical: [new URL("/.well-known/security.txt", PROFILE.canonical.origin)],
	policy: [],
	hiring: [],
	extensions: {},
};
