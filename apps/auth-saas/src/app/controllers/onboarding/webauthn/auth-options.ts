import { env } from "cloudflare:workers";

import action from "~/lib/action";

/**
 * Proxy WebAuthn authentication options to platform tenant DO.
 */
export default action<"POST", "/onboarding/webauthn/auth/options">(
	async ({ request, formData }) => {
		let platform = env.TENANT.getByName("platform");

		// Forward the request to the platform tenant's WebAuthn endpoint
		let url = new URL(request.url);
		url.pathname = "/webauthn/auth/options";

		// Convert FormData to URLSearchParams
		let params = new URLSearchParams();
		for (let [key, value] of formData.entries()) {
			if (typeof value === "string") {
				params.append(key, value);
			}
		}

		let forwardRequest = new Request(url.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params,
		});

		return await platform.fetch(forwardRequest);
	},
);
