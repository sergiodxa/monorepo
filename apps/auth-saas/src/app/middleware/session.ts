import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";

import middleware from "~/lib/middleware";

declare module "remix/fetch-router" {
	interface RequestContext {
		platformSession: {
			subjectId: string;
		};
	}
}

const PLATFORM_TENANT_ID = "platform";
const SESSION_COOKIE_NAME = "__auth_session";

/**
 * Session middleware for the platform dashboard.
 * Validates the session cookie against the platform tenant DO and
 * attaches the subject ID to the context.
 */
export default middleware(async (context, next) => {
	let cookies = context.request.headers.get("Cookie") ?? "";
	let sessionId = getCookie(cookies, SESSION_COOKIE_NAME);

	if (!sessionId) {
		return redirect("/onboarding");
	}

	let stub = env.TENANT.getByName(PLATFORM_TENANT_ID);
	let response = await stub.fetch(`https://tenant.internal/api/sessions/${sessionId}`, {
		headers: { Authorization: `Bearer ${sessionId}` },
	});

	if (!response.ok) {
		// Invalid or expired session, redirect to login
		return redirect("/onboarding", {
			headers: {
				"Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
			},
		});
	}

	let session = (await response.json()) as { subject_id: string };

	context.platformSession = {
		subjectId: session.subject_id,
	};

	return next();
});

function getCookie(cookies: string, name: string): string | null {
	let match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ?? null;
}
