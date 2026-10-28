/**
 * Security headers for HTML landing pages and JSON/MCP responses from this Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/** Bunny Fonts stylesheet and font files for Outfit / IBM Plex Mono. */
const FONTS_ORIGIN = "https://fonts.bunny.net";

/**
 * The policy for every apis response. Styles are inline because `remix/component`
 * writes them that way; fonts load from Bunny. JSON and MCP routes do not embed
 * scripts, so the same policy covers the whole Worker.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce"],
		styleSrc: ["self", "unsafe-inline", FONTS_ORIGIN],
		fontSrc: ["self", FONTS_ORIGIN],
		imgSrc: ["self", "data:"],
		connectSrc: ["self"],
		frameAncestors: ["none"],
		objectSrc: ["none"],
		baseUri: ["self"],
	},
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
	},
};
