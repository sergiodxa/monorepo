/**
 * The response security headers every sdxc.dev response is sent with. The Content Security
 * Policy runs Report-Only, reporting to `/reports/csp`, until real traffic shows it can be
 * enforced; the import map joins `script-src` by hash, since a stored page carries no nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/** Where the Cloudflare Web Analytics beacon script loads from. */
const WEB_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";

/** Where the Web Analytics beacon sends its measurements. */
const WEB_ANALYTICS_BEACON_ORIGIN = "https://cloudflareinsights.com";

/** Where GitHub serves the sponsor avatars the sponsors page and block render. */
const GITHUB_AVATARS_ORIGIN = "https://avatars.githubusercontent.com";

/**
 * The policy for every sdxc.dev response. Styles are inline because `remix/component` writes
 * them that way, and images are the site's own, inline demo pictures, or sponsor avatars.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
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
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		"browsing-topics": [],
	},
};
