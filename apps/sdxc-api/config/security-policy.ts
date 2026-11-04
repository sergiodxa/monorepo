/**
 * Security headers for HTML landing pages and JSON/MCP responses from this Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/** Bunny Fonts stylesheet and font files for Outfit / IBM Plex Mono. */
const FONTS_ORIGIN = "https://fonts.bunny.net";

/**
 * The Content-Security-Policy Remix's `csp()` sends for every response. Styles are inline
 * because `remix/component` writes them that way; fonts load from Bunny. JSON and MCP routes
 * do not embed scripts, so the same policy covers the whole Worker.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce"],
	styleSrc: ["self", "unsafe-inline", FONTS_ORIGIN],
	fontSrc: ["self", FONTS_ORIGIN],
	imgSrc: ["self", "data:"],
	connectSrc: ["self"],
	frameAncestors: ["none"],
	objectSrc: ["none"],
	baseUri: ["self"],
};

/** The non-CSP headers every apis response carries. */
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
	},
};
