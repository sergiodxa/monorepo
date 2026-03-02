import { env } from "cloudflare:workers";

import action from "~/lib/action";

/**
 * Proxy WebAuthn authentication verification to platform tenant DO.
 * This endpoint receives JSON body.
 */
export default action<"POST", "/onboarding/webauthn/auth/verify">(async ({ request }) => {
	let platform = env.TENANT.getByName("platform");

	// Clone the request body before it's consumed
	let body = await request.text();

	// Forward the request to the platform tenant's WebAuthn endpoint
	let url = new URL(request.url);
	url.pathname = "/webauthn/auth/verify";

	let forwardRequest = new Request(url.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body,
	});

	return await platform.fetch(forwardRequest);
});
