/**
 * The blog's response security headers. The Content-Security-Policy is sent Report-Only,
 * reporting to `/reports/csp`, until the origins article images and embeds load from are
 * audited; the import map joins `script-src` by hash, since a cached page carries no nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/**
 * Enforced: MIME sniffing off, a one-year HSTS for the apex only (subdomains are separate
 * apps), no cross-window access, and the powerful features denied.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		scriptSrc: ["self"],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self", "data:"],
		fontSrc: ["self"],
		connectSrc: ["self"],
		frameSrc: ["https://www.youtube-nocookie.com"],
		frameAncestors: ["none"],
		formAction: ["self", "https://auth.sergiodxa.com"],
		baseUri: ["none"],
		objectSrc: ["none"],
		reportTo: "csp",
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		"browsing-topics": [],
	},
};
