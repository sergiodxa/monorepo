/**
 * The OpenID Connect Session Management 1.0 check-session endpoint. It serves a page
 * relying parties embed in a hidden iframe: the RP posts `"<client_id> <session_state>"`
 * to it, the page recomputes the expected `session_state` from the `op_browser_state`
 * cookie it can read on this origin, and answers `"unchanged"` or `"changed"` — which
 * lets an RP notice a sign-out without polling this server over the network.
 *
 * **This module is deliberately exempt from the "no HTML strings" rule.** The artifact
 * this endpoint publishes *is* a browser-side script page defined by the specification,
 * running in the relying party's frame rather than in any page this app renders. It has
 * no server-side data interpolated into it, so expressing it as `remix/ui` JSX would
 * only obscure the one thing that matters here — that the bytes match the spec — and
 * would put a component tree between this app and a contract other origins depend on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/web";

/**
 * How long a browser may reuse this page. It is a static document with no per-request
 * content, and RPs load it on every page view of theirs.
 */
const CACHE_CONTROL = "public, max-age=3600";

/**
 * The check-session iframe document.
 *
 * Entirely static, with no interpolation of any kind: nothing about the request reaches
 * this string, which is why it can be served as-is without an escaping concern.
 */
const CHECK_SESSION_HTML = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Check Session</title>
</head>
<body>
<script>
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
</script>
</body>
</html>`;

/**
 * GET /oidc/check-session — serves the RP-embeddable session-checking iframe.
 *
 * No framing header is sent, and none should be: being loaded cross-origin in another
 * site's iframe is the entire point of this endpoint, so an `X-Frame-Options` or a
 * `frame-ancestors` policy here would break every relying party that uses it.
 */
export default createAction(routes.oidc.checkSession, () => {
	return new Response(CHECK_SESSION_HTML, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": CACHE_CONTROL,
		},
	});
});
