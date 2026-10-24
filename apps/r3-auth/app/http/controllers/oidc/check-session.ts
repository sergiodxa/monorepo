/**
 * The OpenID Connect Session Management 1.0 check-session endpoint: a page relying
 * parties embed in a hidden iframe, which recomputes the expected `session_state` from
 * the `op_browser_state` cookie readable on this origin and answers `"unchanged"` or
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64, sha256 } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/**
 * How long a browser may reuse this page. The document is static and every relying
 * party loads it on every page view of theirs.
 */
const CACHE_CONTROL = "public, max-age=3600";

/**
 * The script answering relying parties' `postMessage` checks. Fixed here, so its SHA-256 hash
 * admits it under the Content Security Policy on every response.
 */
const CHECK_SESSION_SCRIPT = `
(function() {
	// Get the OP browser state from cookie
	function getOpBrowserState() {
		var cookies = document.cookie.split(';');
		for (var i = 0; i < cookies.length; i++) {
			var cookie = cookies[i].trim();
			if (cookie.indexOf('op_browser_state=') === 0) {
				return cookie.substring('op_browser_state='.length);
			}
		}
		return '';
	}

	// SHA-256 hash function using SubtleCrypto
	async function sha256(message) {
		var encoder = new TextEncoder();
		var data = encoder.encode(message);
		var hashBuffer = await crypto.subtle.digest('SHA-256', data);
		var hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
	}

	// Handle incoming messages from RPs
	window.addEventListener('message', async function(e) {
		// Validate origin - only accept messages from HTTPS origins
		if (!e.origin || (!e.origin.startsWith('https://') && !e.origin.startsWith('http://localhost'))) {
			return;
		}

		// Parse the message: "client_id session_state"
		var data = e.data;
		if (typeof data !== 'string') {
			return;
		}

		var lastSpace = data.lastIndexOf(' ');
		if (lastSpace === -1) {
			e.source.postMessage('error', e.origin);
			return;
		}

		var clientId = data.substring(0, lastSpace);
		var sessionState = data.substring(lastSpace + 1);

		// Parse session_state: "hash.salt"
		var dotIndex = sessionState.lastIndexOf('.');
		if (dotIndex === -1) {
			e.source.postMessage('error', e.origin);
			return;
		}

		var salt = sessionState.substring(dotIndex + 1);

		// Get current OP browser state
		var opBrowserState = getOpBrowserState();

		// Compute expected session_state
		// Per spec: SHA-256(client_id + " " + origin + " " + op_browser_state + " " + salt) + "." + salt
		var input = clientId + ' ' + e.origin + ' ' + opBrowserState + ' ' + salt;
		var hash = await sha256(input);
		var expectedSessionState = hash + '.' + salt;

		// Compare and respond
		if (sessionState === expectedSessionState) {
			e.source.postMessage('unchanged', e.origin);
		} else {
			e.source.postMessage('changed', e.origin);
		}
	});
})();
`;

/**
 * The check-session iframe document. Every byte of it is fixed here, independent of the
 * request, so it is safe to serve verbatim.
 */
const CHECK_SESSION_HTML = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Check Session</title>
</head>
<body>
<script>${CHECK_SESSION_SCRIPT}</script>
</body>
</html>`;

/**
 * GET /oidc/check-session — serves the RP-embeddable session-checking iframe. Every
 * relying party loads it cross-origin, so framing stays open to any origin: an
 * `X-Frame-Options` or `frame-ancestors` policy here would break all of them.
 */
export default createAction(routes.oidc.checkSession, async (ctx) => {
	let digest = await sha256(CHECK_SESSION_SCRIPT);
	let scriptSrc = ctx.securityHeaders.policy.contentSecurityPolicyReportOnly?.scriptSrc ?? [];
	ctx.securityHeaders.override({
		contentSecurityPolicyReportOnly: {
			frameAncestors: null,
			scriptSrc: isSuccess(digest)
				? [...scriptSrc, `sha256-${Base64.encode(digest.data)}`]
				: scriptSrc,
		},
	});

	return new Response(CHECK_SESSION_HTML, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": CACHE_CONTROL,
		},
	});
});
