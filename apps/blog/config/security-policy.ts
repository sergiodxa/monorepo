/**
 * The blog's response security headers. The Content-Security-Policy is sent Report-Only,
 * reporting to `/reports/csp`, until the origins article images and embeds load from are
 * audited; the import map joins `script-src` by hash, since a cached page carries no nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/**
 * The Report-Only Content-Security-Policy Remix's `csp()` sends. Keywords stay unquoted;
 * `remixCsp` quotes them for the middleware.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self"],
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:", "https://avatars.githubusercontent.com"],
	fontSrc: ["self"],
	connectSrc: ["self"],
	frameSrc: ["https://www.youtube-nocookie.com"],
	frameAncestors: ["none"],
	formAction: ["self", "https://auth.sergiodxa.com"],
	baseUri: ["none"],
	objectSrc: ["none"],
	reportTo: "csp",
};

/**
 * Enforced: MIME sniffing off, a one-year HSTS for the apex only (subdomains are separate
 * apps), no cross-window access, and the powerful features denied.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
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
