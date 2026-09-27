/**
 * The response security headers every uptime response is sent with. The Content Security
 * Policy runs Report-Only, reporting to `/reports/csp`, until real traffic shows it can be
 * enforced; every other header applies now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/** Where Cloudflare Turnstile loads its script and renders its challenge iframe. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Where the Cloudflare Web Analytics beacon script loads from. */
const WEB_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";

/** Where the Web Analytics beacon sends its measurements. */
const WEB_ANALYTICS_BEACON_ORIGIN = "https://cloudflareinsights.com";

/**
 * The policy for every uptime response. Styles are inline because `remix/ui` writes them
 * that way; images take any HTTPS origin because a status page shows the logo its team links;
 * the nonce reaches the import map the client runtime extends with every client entry.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce", WEB_ANALYTICS_SCRIPT_ORIGIN, TURNSTILE_ORIGIN],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self", "data:", "https:"],
		fontSrc: ["self"],
		connectSrc: ["self", WEB_ANALYTICS_BEACON_ORIGIN],
		frameSrc: [TURNSTILE_ORIGIN],
		frameAncestors: ["none"],
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
