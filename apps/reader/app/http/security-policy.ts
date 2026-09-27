/**
 * The policy every response this app sends is read under: a Content-Security-Policy that
 * starts from nothing and permits this origin, and the headers that keep a referrer, a frame,
 * a sniffed type and a device API out of it. A sanitizer bug fails closed against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/**
 * The header set every response carries unless it set a header itself. It names no
 * publisher's host anywhere, so every third-party request a page could make is refused.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		/** A fetch type nobody thought about fails closed; permitting one is a deliberate edit. */
		defaultSrc: ["none"],
		scriptSrc: ["self"],
		/**
		 * The renderer emits each page's rules as `<style>` elements while it streams, where no
		 * hash or nonce is available; the sanitizer's attribute allow-list names no `style`.
		 */
		styleSrc: ["self", "unsafe-inline"],
		/**
		 * A publisher's image reaches a reader through the media route or not at all, so a
		 * tracking pixel that survives the sanitizer still makes no request.
		 */
		imgSrc: ["self"],
		fontSrc: ["self"],
		connectSrc: ["self"],
		/** A browser keeps no push subscription for a page whose manifest it could not read. */
		manifestSrc: ["self"],
		mediaSrc: ["none"],
		frameSrc: ["none"],
		frameAncestors: ["none"],
		formAction: ["self"],
		baseUri: ["none"],
		objectSrc: ["none"],
	},
	/**
	 * Costs small publishers the signal that readers arrive from a feed reader, and keeps their
	 * servers from learning which of this app's pages a reader was standing on.
	 */
	referrerPolicy: "no-referrer",
	strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
	crossOriginOpenerPolicy: "same-origin",
	crossOriginResourcePolicy: "same-origin",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		/** The browser's own advertising-topics API, which needs no publisher's cooperation. */
		"browsing-topics": [],
	},
};
