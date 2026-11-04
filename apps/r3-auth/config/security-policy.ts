/**
 * The response security headers every identity-provider response is sent with. The Content
 * Security Policy runs Report-Only, reporting to `/reports/csp`, until real traffic shows it can
 * be enforced; every other header applies now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/**
 * The Report-Only Content-Security-Policy Remix's `csp()` sends. Styles are inline because
 * `remix/component` writes them that way; images take any HTTPS origin because a client's logo
 * and a person's avatar live wherever they were registered. `form-action` stays open: a sign-in
 * POST answers with a redirect to the relying party or the social provider, and browsers check
 * that redirect against it too.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce"],
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:", "https:"],
	fontSrc: ["self"],
	connectSrc: ["self"],
	frameAncestors: ["none"],
	objectSrc: ["none"],
	baseUri: ["self"],
	reportTo: "csp",
};

/** The non-CSP headers every identity-provider response carries. */
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
