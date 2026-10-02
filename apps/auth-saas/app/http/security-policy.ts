/**
 * The response security headers each of the Worker's three routers sends. The browser-
 * facing hosts watch their Content Security Policy in Report-Only mode, reporting to
 * `/reports/csp`, until the reports show it can be enforced; every other header applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

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
 * The hosted sign-in pages on a tenant's host. `remix/component` writes its styles inline, so
 * `style-src` allows them; `form-action` stays open because an authorization completes
 * by redirecting a form submission to the client's own origin. `Referrer-Policy:
 * no-referrer` keeps the tokens a magic link or reset URL carries out of `Referer`, and
 * the opener is left intact for relying parties that run the flow in a popup.
 */
export const TENANT_SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
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
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "no-referrer",
	permissionsPolicy: PERMISSIONS_POLICY,
};

/**
 * The platform's own pages: the landing page, the billing redirects, and `/signup`, whose
 * form embeds the Turnstile widget.
 */
export const PLATFORM_SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
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
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: PERMISSIONS_POLICY,
};

/**
 * The management API, which answers JSON only: a document it serves may load nothing and
 * be framed nowhere, so the policy is enforced from the start.
 */
export const MANAGEMENT_SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["none"],
		frameAncestors: ["none"],
	},
	strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
	referrerPolicy: "no-referrer",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: PERMISSIONS_POLICY,
};
