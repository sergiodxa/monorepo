/**
 * The response security headers each of the Worker's three routers sends. The browser-
 * facing hosts watch their Content Security Policy in Report-Only mode, reporting to
 * `/reports/csp`, until the reports show it can be enforced; every other header applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

/** Where Cloudflare Turnstile loads its script and renders its challenge iframe. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * One year of HTTPS-only, per host: tenant custom domains belong to customers, so the
 * policy leaves their subdomains alone.
 */
const STRICT_TRANSPORT_SECURITY: SecurityHeaders.StrictTransportSecurity = {
	maxAge: 31536000,
};

/** The device features no hosted or platform page asks for. */
const PERMISSIONS_POLICY: SecurityHeaders.Policy["permissionsPolicy"] = {
	camera: [],
	microphone: [],
	geolocation: [],
	payment: [],
	usb: [],
	"browsing-topics": [],
};

/**
 * The hosted sign-in pages' Report-Only Content-Security-Policy. `remix/component` writes its
 * styles inline, so `style-src` allows them; `form-action` stays open because an authorization
 * completes by redirecting a form submission to the client's own origin.
 */
export const TENANT_CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce", TURNSTILE_ORIGIN],
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:"],
	fontSrc: ["self"],
	connectSrc: ["self"],
	frameSrc: [TURNSTILE_ORIGIN],
	frameAncestors: ["none"],
	objectSrc: ["none"],
	baseUri: ["none"],
	reportTo: "csp",
};

/** The non-CSP headers the tenant router sends. */
export const TENANT_SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "no-referrer",
	xFrameOptions: "DENY",
	permissionsPolicy: PERMISSIONS_POLICY,
};

/**
 * The platform pages' Report-Only Content-Security-Policy: the landing page, the billing
 * redirects, and `/signup`, whose form embeds the Turnstile widget.
 */
export const PLATFORM_CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce", TURNSTILE_ORIGIN],
	styleSrc: ["self", "unsafe-inline"],
	imgSrc: ["self", "data:"],
	fontSrc: ["self"],
	connectSrc: ["self"],
	frameSrc: [TURNSTILE_ORIGIN],
	frameAncestors: ["none"],
	objectSrc: ["none"],
	baseUri: ["none"],
	reportTo: "csp",
};

/** The non-CSP headers the platform router sends. */
export const PLATFORM_SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	xFrameOptions: "DENY",
	permissionsPolicy: PERMISSIONS_POLICY,
};

/**
 * The management API's enforced Content-Security-Policy: a document it serves may load nothing
 * and be framed nowhere.
 */
export const MANAGEMENT_CONTENT_SECURITY_POLICY: CSP.Directives = {
	defaultSrc: ["none"],
	frameAncestors: ["none"],
};

/**
 * The management API's non-CSP headers, which answer JSON only so the policy is enforced from
 * the start.
 */
export const MANAGEMENT_SECURITY_POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "no-referrer",
	crossOriginOpenerPolicy: "same-origin",
	xFrameOptions: "DENY",
	permissionsPolicy: PERMISSIONS_POLICY,
};
