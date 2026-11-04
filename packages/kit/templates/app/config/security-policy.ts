/**
 * The security headers every page is sent with: a Content-Security-Policy that admits this
 * origin and the response's nonce (via Remix `csp()`), and the headers that keep the page out
 * of frames and its referrer and device APIs to itself. Name an origin here before a page loads
 * from it.
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/** Where Cloudflare Turnstile loads its script and renders its challenge frame. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * The Content-Security-Policy Remix's `csp()` sends for every page. Keywords stay unquoted;
 * `remixCsp` quotes them and substitutes the request nonce.
 */
export const CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	/** The document's inline import map is admitted by the response's nonce. */
	scriptSrc: ["self", "nonce", TURNSTILE_ORIGIN],
	/** `css()` styles render as `<style>` elements; Remix stamps the nonce when `csp()` runs. */
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:"],
	fontSrc: ["self"],
	/** Same-origin requests, including the dev server's HMR socket. */
	connectSrc: ["self"],
	frameSrc: [TURNSTILE_ORIGIN],
	formAction: ["self"],
	frameAncestors: ["none"],
	baseUri: ["none"],
	objectSrc: ["none"],
};

/** The non-CSP policy `app/http/middleware/page.ts` applies to every page response. */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: { maxAge: 31_536_000 },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	xFrameOptions: "DENY",
	permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], usb: [] },
};
