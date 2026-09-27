/**
 * The RFC 9116 security.txt uptime serves at `/.well-known/security.txt`, telling a
 * researcher who finds a vulnerability in the product holding customers' API keys where to
 * report it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { serve } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";

import { absoluteUrl } from "~/app/lib/origin";

/**
 * The file's fields. `expires` is a literal date so a person reviews the contact at least
 * once a year; `security-txt.test.ts` fails 30 days before it passes.
 */
export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:hello+security@sergiodxa.com")],
	expires: new Date("2027-09-26T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en", "es"],
	canonical: [new URL(absoluteUrl("/.well-known/security.txt"))],
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
