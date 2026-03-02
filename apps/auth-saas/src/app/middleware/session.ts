import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";

import middleware from "~/lib/middleware";

declare module "remix/fetch-router" {
	interface RequestContext {
		platformSession: {
			subjectId: string;
			email: string;
		};
	}
}

const PLATFORM_TENANT_ID = "platform";
const SESSION_COOKIE_NAME = "__platform_session";

/**
 * Session middleware for the platform dashboard.
 * Validates that the subject exists in the platform tenant DO and
 * attaches the subject info to the context.
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("session");

	let cookies = context.request.headers.get("Cookie") ?? "";
	let subjectId = getCookie(cookies, SESSION_COOKIE_NAME);

	if (!subjectId) {
		log.info("No session cookie found, redirecting to onboarding");
		return redirect("/onboarding");
	}

	// Validate subject exists in platform tenant
	let stub = env.TENANT.getByName(PLATFORM_TENANT_ID);
	let response = await stub.fetch(`https://tenant.internal/api/subjects/${subjectId}`, {
		method: "GET",
		headers: {
			// The management API requires auth, but we're calling internally
			// We need to either skip auth for internal calls or use a management token
			"X-Internal-Request": "true",
		},
	});

	if (!response.ok) {
		log.info("Subject not found or invalid, clearing session", { subjectId });
		// Invalid subject, clear cookie and redirect to login
		return redirect("/onboarding", {
			headers: {
				"Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
			},
		});
	}

	let subject = (await response.json()) as { id: string; email: string };

	context.platformSession = {
		subjectId: subject.id,
		email: subject.email,
	};

	log.info("Session validated", { subjectId: subject.id });

	return next();
});

function getCookie(cookies: string, name: string): string | null {
	let match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match?.[1] ?? null;
}
