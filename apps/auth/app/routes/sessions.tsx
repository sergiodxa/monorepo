import { href, Link, redirect } from "react-router";

import AccessToken from "~/entities/access-token";
import AuthzCode from "~/entities/authz-code";
import IdToken from "~/entities/id-token";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Subject from "~/models/subject";
import { sign } from "~/modules/jwks";

import type { Route } from "./+types/sessions";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let state = url.searchParams.get("state");
	let code = url.searchParams.get("code");

	if (state && code) {
		let result = await AuthzCode.find(code);
		if (!result) return redirect(href("/oidc/logout"));

		let subject = await Subject.findById(db(), result.subjectId);
		if (!subject) return redirect(href("/oidc/logout"));

		let [accessToken, idToken] = await Promise.all([
			sign(AccessToken.generate(result.clientId, result.subjectId)),
			sign(
				IdToken.generate(
					{
						id: subject.id,
						email: subject.emailAddress,
						avatar: subject.avatar,
						username: subject.username,
						displayName: subject.displayName,
						emailVerified: true, // TODO: Check if email is verified
					},
					{ id: result.clientId },
				),
			),
		]);

		return {
			sub: result.subjectId,
			tokens: { idToken, accessToken, refreshToken: result.sessionId },
		};
	}

	let sub = session().get("sub");
	if (!sub) return redirect(href("/authorize"));
	return { sub };
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main>
			<h1>Sessions</h1>
			<pre>
				<code>{JSON.stringify(loaderData, null, "\t")}</code>
			</pre>
			<Link reloadDocument to={href("/oidc/logout")}>
				Logout
			</Link>
		</main>
	);
}
