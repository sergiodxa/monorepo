/**
 * The chain every page controller passes as its `middleware`: form body, cross-origin check,
 * session, access, language, honeypot, security headers, and the document's assets and
 * renderer, so only requests that render a document pay for them.
 */

import { assets } from "@sdxc/assets-middleware";
import { honeypot } from "@sdxc/honeypot/middleware";
import i18n from "@sdxc/i18n/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createMiddleware } from "remix/router";

import access from "~/app/http/middleware/access";
import { assetResolver } from "~/app/initializers/assets";
import { honeypot as trap } from "~/app/initializers/honeypot";
import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";
import { sessionCookie, sessionStorage } from "~/app/initializers/session";
import { SECURITY_POLICY } from "~/config/security-policy";

/**
 * Publishes `ctx.formData`, `ctx.session`, `ctx.access`, `ctx.locale`, `ctx.intl`, `ctx.honeypot`,
 * `ctx.securityHeaders`, `ctx.assets` and `ctx.render` on a page's context. A POST without valid honeypot fields is refused with a 400
 * before the controller runs; the security headers come right before the assets and renderer.
 */
export default createMiddleware(
	formData(),
	cop(),
	session(sessionCookie, sessionStorage),
	access,
	i18n({
		detection: {
			supportedLanguages: SUPPORTED_LANGUAGES,
			fallbackLanguage: FALLBACK_LANGUAGE,
			sessionKey: "lng",
		},
		resources: RESOURCES,
	}),
	honeypot(trap),
	securityHeaders(SECURITY_POLICY),
	assets(assetResolver, {
		stylesheets: "resources/layouts/document.tsx",
		script: "bootstrap/browser.ts",
		nonce: (ctx) => ctx.securityHeaders.nonce,
	}),
	render({ assets: assetResolver }),
);
