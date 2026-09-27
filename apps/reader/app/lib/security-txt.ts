/**
 * The RFC 9116 security.txt the reader serves at `/.well-known/security.txt`, telling a
 * researcher who finds a vulnerability in the app holding readers' subscriptions and agent
 * tokens where to report it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { serve } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";

/**
 * The file's fields. `expires` is a literal date so a person reviews the contact at least once
 * a year; `security-txt.test.ts` fails 30 days before it passes. `canonical` names the custom
 * domain `wrangler.jsonc` routes, which is the one address the file is published at.
 */
export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:hello+security@sergiodxa.com")],
	expires: new Date("2027-09-26T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en", "es"],
	canonical: [new URL("https://reader.sergiodxa.com/.well-known/security.txt")],
	policy: [],
	hiring: [],
	extensions: {},
};

/**
 * The `wellKnown()` entry answering `/.well-known/security.txt` with {@link SECURITY_TXT}.
 *
 * @example wellKnown({ "security.txt": securityTxtEntry });
 */
export const securityTxtEntry = serve(securityTxt, () => SECURITY_TXT);
