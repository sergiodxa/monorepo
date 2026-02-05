import { data, href, redirect } from "react-router";
import { OAuth2RequestError } from "remix-auth-oauth2";
import { safeRedirect } from "remix-utils/safe-redirect";

import { returnTo } from "~/cookies";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { getSession } from "~/middleware/session";
import { authenticate } from "~/modules/auth";

import type { Route } from "./+types/auth";

export async function loader({ request }: Route.LoaderArgs) {
	try {
		let { id, teams } = await measure("authenticate", () => {
			return authenticate(request);
		});

		let session = getSession();
		session.set("id", id.subject);
		session.set("name", id.name);
		session.set("email", id.email);
		session.set("avatar", id.picture);

		let firstTeam = teams[0];
		if (!firstTeam) {
			logger().error("auth.no_teams", { subjectId: id.subject });
			throw new Error("No teams found");
		}

		logger().info("auth.success", { subjectId: id.subject, teamCount: teams.length });

		return redirect(
			safeRedirect(await returnTo.parse(request.headers.get("Cookie")), href("/app")),
		);
	} catch (error) {
		if (error instanceof OAuth2RequestError) {
			logger().error("auth.oauth_error", {
				code: error.code,
				description: error.description,
			});
			return data(
				{ code: error.code, description: error.description, uri: error.uri },
				{ status: 400 },
			);
		}
		throw error;
	}
}

export async function action({ request }: Route.ActionArgs) {
	return await authenticate(request);
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main>
			<h1>Authentication Error</h1>
			{loaderData?.code && (
				<div>
					<p>Error Code: {loaderData.code}</p>
					<p>Description: {loaderData.description}</p>
					{loaderData.uri && (
						<p>
							URI:{" "}
							<a href={loaderData.uri} target="_blank" rel="noopener noreferrer">
								{loaderData.uri}
							</a>
						</p>
					)}
				</div>
			)}

			<p>Please try again or contact support if the issue persists.</p>
		</main>
	);
}
