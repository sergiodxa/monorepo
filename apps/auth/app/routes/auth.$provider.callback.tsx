import { redirectDocument } from "react-router";

import { badRequest } from "~/helpers/response";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import { github } from "~/providers/github";
import loginWithProvider from "~/services/login/with-provider";

import type { Route } from "./+types/auth.$provider.callback";

export async function loader({ request, params }: Route.LoaderArgs) {
	let sub: string;

	if (params.provider === "github") {
		sub = await github(db(), request);
	} else {
		return badRequest({ message: "Invalid provider" });
	}

	let authz = session().get("authz");
	if (!authz) return badRequest({ message: "Invalid request" });

	let result = await loginWithProvider({
		subjectId: sub,
		clientId: authz.clientId,
		ip: null,
		ua: request.headers.get("user-agent"),
		redirectUri: authz.redirectUri,
		state: authz.state,
	});

	if (result.status === "success") {
		session().unset("authz"); // Remove the authz object from the session
		session().set("sub", sub); // Keep the subject logged-in for SSO
		return redirectDocument(result.payload.url.toString());
	}

	let url = new URL(authz.redirectUri);
	url.searchParams.set("state", authz.state);
	url.searchParams.set("error", result.error.code);
	url.searchParams.set("error_description", result.error.description);

	return redirectDocument(url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
			<p>{loaderData.message}</p>
		</main>
	);
}
