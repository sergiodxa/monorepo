/**
 * The platform's RFC 9116 security.txt, served on the platform, management and every
 * tenant host so a researcher finds the same contact wherever they probe; `Canonical`
 * names the host answering, since each host's file is canonical there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { serve } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";

/**
 * The file's fields for every host. `expires` is a literal date so a person reviews the
 * contact at least once a year; `security-txt.test.ts` fails 30 days before it passes.
 */
export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:hello+security@sergiodxa.com")],
	expires: new Date("2027-09-26T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en", "es"],
	canonical: [],
	policy: [],
	hiring: [],
	extensions: {},
};

/**
 * The `wellKnown()` entry answering `/.well-known/security.txt` with {@link SECURITY_TXT},
 * its `Canonical` set to the requesting host's own HTTPS URL for the file.
 *
 * @example
 * wellKnown({ "security.txt": securityTxtEntry });
 */
export const securityTxtEntry = serve(securityTxt, (ctx) => ({
	...SECURITY_TXT,
	canonical: [new URL(`https://${ctx.url.host}/.well-known/security.txt`)],
}));
