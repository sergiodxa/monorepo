import { env } from "cloudflare:workers";

import action from "~/lib/action";

const SESSION_COOKIE_NAME = "__platform_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Proxy WebAuthn registration verification to platform tenant DO.
 * On success, sets the session cookie with proper security flags.
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

	// If registration succeeded, set the session cookie server-side
	if (response.ok) {
		let data = (await response.json()) as { success: boolean; subjectId?: string };

		if (data.success && data.subjectId) {
			let isSecure = !import.meta.env.DEV;
			let cookieValue = [
				`${SESSION_COOKIE_NAME}=${data.subjectId}`,
				"Path=/",
				"HttpOnly",
				"SameSite=Lax",
				`Max-Age=${SESSION_MAX_AGE}`,
			];

			if (isSecure) {
				cookieValue.push("Secure");
			}

			return new Response(JSON.stringify(data), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Set-Cookie": cookieValue.join("; "),
				},
			});
		}
	}

	return response;
});
