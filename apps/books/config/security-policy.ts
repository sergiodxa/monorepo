/**
 * The response security headers every books response is sent with. The Content Security Policy
 * runs Report-Only, reporting to `/reports/csp`, until real traffic shows it can be enforced;
 * every other header applies now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/** Where the Cloudflare Web Analytics beacon script loads from. */
const WEB_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";

/** Where the Web Analytics beacon sends its measurements. */
const WEB_ANALYTICS_BEACON_ORIGIN = "https://cloudflareinsights.com";

/** Where the purchasing-power-parity banner script loads from on the sales page. */
const PARITY_DEALS_SCRIPT_ORIGIN = "https://cdn.paritydeals.com";

/** Where the banner script asks which discount the visitor's country gets. */
const PARITY_DEALS_API_ORIGIN = "https://api.paritydeals.com";

/**
 * The policy for every books response. Styles are inline because `remix/component` writes them
 * that way and the parity banner injects its own `<style>`; images take any HTTPS origin because
 * the banner's markup comes from its API. The nonce reaches the import map of a hydrating page.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce", WEB_ANALYTICS_SCRIPT_ORIGIN, PARITY_DEALS_SCRIPT_ORIGIN],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self", "data:", "https:"],
		fontSrc: ["self"],
		connectSrc: ["self", WEB_ANALYTICS_BEACON_ORIGIN, PARITY_DEALS_API_ORIGIN],
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
