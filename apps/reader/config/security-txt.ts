/**
 * The RFC 9116 security.txt the reader serves at `/.well-known/security.txt`, telling a
 * researcher who finds a vulnerability in the app holding readers' subscriptions and agent
 * tokens where to report it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityTxt } from "@sdxc/well-known/security-txt";

import { currentLog } from "@sdxc/logger";
import { serve } from "@sdxc/well-known/middleware";
import { cleartextSigner, securityTxt } from "@sdxc/well-known/security-txt";
import { env } from "cloudflare:workers";

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
 * Wraps the file in an OpenPGP cleartext signature made with the armored private key in the
 * `SECURITY_TXT_SIGNING_KEY` secret. While the secret is unset the file is served unsigned,
 * and a key that cannot sign is logged and the file served unsigned.
 */
export const signSecurityTxt = cleartextSigner({
	key: () => env.SECURITY_TXT_SIGNING_KEY,
	onError: (error) =>
		currentLog()?.warn("security_txt.unsigned", { code: error.code, reason: error.message }),
});

/**
 * The `Encryption` field: the published OpenPGP public key at `SECURITY_TXT_ENCRYPTION_URL`,
 * when that variable holds an `https` URL, and no field otherwise.
 *
 * @param value - The configured URL.
 */
export function encryptionKeys(value: string | undefined = env.SECURITY_TXT_ENCRYPTION_URL): URL[] {
	if (value === undefined) return [];
	if (!URL.canParse(value)) return [];
	let url = new URL(value);
	return url.protocol === "https:" ? [url] : [];
}

/**
 * The `wellKnown()` entry answering `/.well-known/security.txt` with {@link SECURITY_TXT},
 * `Encryption` filled from {@link encryptionKeys} and the body signed by {@link signSecurityTxt}.
 *
 * @example wellKnown({ "security.txt": securityTxtEntry });
 */
export const securityTxtEntry = serve(
	securityTxt,
	() => ({ ...SECURITY_TXT, encryption: encryptionKeys() }),
	{ transform: signSecurityTxt },
);
