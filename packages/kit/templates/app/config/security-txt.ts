/**
 * The app's security.txt (RFC 9116), served at `/.well-known/security.txt` so a researcher who
 * finds a vulnerability knows where to report it. Review it before `expires`; a test fails a
 * month ahead so the file never goes stale.
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { serve } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";

import { SITE_URL } from "~/config/constants";

/** Where reports go and until when this file is current; replace the contact with yours. */
export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-10-15T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en"],
	canonical: [new URL("/.well-known/security.txt", SITE_URL)],
	policy: [],
	hiring: [],
	extensions: {},
};

/** The entry the router's `wellKnown()` serves the file through. */
export const securityTxtEntry = serve(securityTxt, () => SECURITY_TXT);
