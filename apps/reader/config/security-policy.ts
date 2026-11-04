/**
 * The policy every response this app sends is read under: a Content-Security-Policy that
 * starts from nothing and permits this origin, and the headers that keep a referrer, a frame,
 * a sniffed type and a device API out of it. A sanitizer bug fails closed against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/**
 * The Content-Security-Policy Remix's `csp()` sends. It names no publisher's host anywhere, so
 * every third-party request a page could make is refused; the only other hosts are the ones a
 * form's redirect hands the reader to.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	/** A fetch type nobody thought about fails closed; permitting one is a deliberate edit. */
	defaultSrc: ["none"],
	/**
	 * The document's import map is the one inline script, admitted by this response's
	 * nonce; a frame's response, which renders no document, advertises none.
	 */
	scriptSrc: ["self", "nonce"],
	/**
	 * The renderer emits each page's rules as `<style>` elements while it streams, where no
	 * hash or nonce is available; the sanitizer's attribute allow-list names no `style`.
	 */
	styleSrc: ["self", "unsafe-inline"],
	/**
	 * A publisher's image reaches a reader through the media route or not at all, so a
	 * tracking pixel that survives the sanitizer still makes no request. `data:` admits the
	 * inline SVG masks the interface draws its check marks with, which fetch nothing.
	 */
	imgSrc: ["self", "data:"],
	fontSrc: ["self"],
	connectSrc: ["self"],
	/** A browser keeps no push subscription for a page whose manifest it could not read. */
	manifestSrc: ["self"],
	mediaSrc: ["none"],
	frameSrc: ["none"],
	frameAncestors: ["none"],
	/**
	 * The browser holds every redirect a form submission follows to this list, so it names
	 * where those redirects lead: the identity provider for signing in and out, and the
	 * payment platform's checkout and billing portal.
	 */
	formAction: ["self", "https://auth.sergiodxa.com", "https://polar.sh", "https://buy.polar.sh"],
	baseUri: ["none"],
	objectSrc: ["none"],
};

/**
 * The non-CSP header set every response carries unless it set a header itself.
 */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	/**
	 * Costs small publishers the signal that readers arrive from a feed reader, and keeps their
	 * servers from learning which of this app's pages a reader was standing on.
	 */
	referrerPolicy: "no-referrer",
	strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
	crossOriginOpenerPolicy: "same-origin",
	crossOriginResourcePolicy: "same-origin",
	xFrameOptions: "DENY",
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
