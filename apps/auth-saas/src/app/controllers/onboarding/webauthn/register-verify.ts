import { env } from "cloudflare:workers";

import action from "~/lib/action";
import { createSessionCookie, createSessionToken } from "~/lib/platform-session";

/**
 * Proxy WebAuthn registration verification to platform tenant DO.
 * On success, sets a signed session cookie.
 */
export default action<"POST", "/onboarding/webauthn/register/verify">(async ({ request }) => {
	let platform = env.TENANT.getByName("platform");

	// Clone the request body before it's consumed
	let body = await request.text();

	// Forward the request to the platform tenant's WebAuthn endpoint
	let url = new URL(request.url);
	url.pathname = "/webauthn/register/verify";

	let forwardRequest = new Request(url.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body,
	});

	let response = await platform.fetch(forwardRequest);

	// If registration succeeded, set the signed session cookie
	if (response.ok) {
		let data = (await response.json()) as { success: boolean; subjectId?: string; email?: string };

		if (data.success && data.subjectId && data.email) {
			let isProduction = !import.meta.env.DEV;

			// Create signed session token
			let token = await createSessionToken(data.subjectId, data.email, env.SESSION_SECRET);

			// Don't expose subjectId in response - session is in cookie
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Set-Cookie": createSessionCookie(token, isProduction),
				},
			});
		}
	}

	return response;
});
