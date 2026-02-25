import { html } from "@pkg/http/response";

/**
 * Create a form_post response mode response per OAuth 2.0 Form Post Response Mode
 *
 * Returns an HTML page with an auto-submitting form that POSTs the authorization
 * response parameters to the redirect URI.
 *
 * @see https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html
 */
export function formPostResponse(redirectUri: string, params: Record<string, string>): Response {
	// Build hidden input fields for each parameter
	let inputs = Object.entries(params)
		.map(
			([name, value]) =>
				`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
		)
		.join("\n        ");

	let body = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Submitting Authorization Response...</title>
</head>
<body onload="document.forms[0].submit()">
    <noscript>
        <p>JavaScript is required to complete this authorization request.</p>
        <form method="post" action="${escapeHtml(redirectUri)}">
            ${inputs}
            <button type="submit">Continue</button>
        </form>
    </noscript>
    <form method="post" action="${escapeHtml(redirectUri)}">
        ${inputs}
    </form>
</body>
</html>`;

	return html(body, {
		headers: {
			// Prevent caching of this response
			"Cache-Control": "no-store",
			Pragma: "no-cache",
		},
	});
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
