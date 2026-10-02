/**
 * The blog's response security headers. The Content-Security-Policy is sent Report-Only
 * until the origins article images and embeds load from are audited, and it carries no
 * nonce, because the edge cache replays a stored page to every visitor byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/**
 * Enforced: MIME sniffing off, a one-year HSTS for the apex only (subdomains are separate
 * apps), no cross-window access, and the powerful features denied. Observed only: a CSP
 * limited to the site's own origin, plus `data:` images and the inline `<style>` blocks
 * `remix/component` renders; the login form posts on to the auth server.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		scriptSrc: ["self"],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self", "data:"],
		fontSrc: ["self"],
		connectSrc: ["self"],
		frameAncestors: ["none"],
		formAction: ["self", "https://auth.sergiodxa.com"],
		baseUri: ["none"],
		objectSrc: ["none"],
	},
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
