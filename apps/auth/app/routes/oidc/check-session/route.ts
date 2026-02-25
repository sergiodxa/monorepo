import type { Route } from "./+types/route";

/**
 * OIDC Session Management Check Session Endpoint
 *
 * Returns an HTML/JS page that can be embedded in an iframe to allow RPs
 * to check if the user's session is still valid without a network request.
 *
 * The RP sends a postMessage with "client_id session_state" and receives
 * back "changed" or "unchanged" based on whether the session is still valid.
 *
 * @see https://openid.net/specs/openid-connect-session-1_0.html
 */
export function loader(_: Route.LoaderArgs) {
	// The check_session_iframe content per OIDC Session Management 1.0
	// This uses the browser's cookie state to verify session validity
	let html = `<!DOCTYPE html>
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

	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			// Allow embedding in iframes from any origin
			"X-Frame-Options": "ALLOWALL",
			// Cache for a short time
			"Cache-Control": "public, max-age=3600",
		},
	});
}
