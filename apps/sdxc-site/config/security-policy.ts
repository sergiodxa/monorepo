/**
 * The response security headers every sdxc.dev response is sent with. The Content Security
 * Policy runs Report-Only, reporting to `/reports/csp`, until real traffic shows it can be
 * enforced; the import map joins `script-src` by hash, since a stored page carries no nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/** Where the Cloudflare Web Analytics beacon script loads from. */
const WEB_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";

/** Where the Web Analytics beacon sends its measurements. */
const WEB_ANALYTICS_BEACON_ORIGIN = "https://cloudflareinsights.com";

/** Where GitHub serves the sponsor avatars the sponsors page and block render. */
const GITHUB_AVATARS_ORIGIN = "https://avatars.githubusercontent.com";

/**
 * The Report-Only Content-Security-Policy Remix's `csp()` sends. Styles are inline because
 * `remix/component` writes them that way, and images are the site's own, inline demo pictures,
 * or sponsor avatars.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", WEB_ANALYTICS_SCRIPT_ORIGIN],
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:", GITHUB_AVATARS_ORIGIN],
	fontSrc: ["self"],
	connectSrc: ["self", WEB_ANALYTICS_BEACON_ORIGIN],
	frameAncestors: ["none"],
	formAction: ["self"],
	objectSrc: ["none"],
	baseUri: ["self"],
	reportTo: "csp",
};

/** The non-CSP headers every sdxc.dev response carries. */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	xFrameOptions: "DENY",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		"browsing-topics": [],
	},
};
