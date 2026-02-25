import { isFailure } from "@pkg/result";
import { Button, Form } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { href, redirect, redirectDocument } from "react-router";
import { z } from "zod";

import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import Session from "~/models/session";
import { sendBackchannelLogoutTokens } from "~/services/backchannel-logout";
import oidc from "~/services/oidc";
import { sessionStorage } from "~/session";
import { getSubjectFromAccessToken } from "~/utils/decode-access-token";

import type { Route } from "./+types/oidc.logout";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Logout | Auth" }];
}

let LogoutSchema = z.object({
	id_token_hint: z.string(),
	post_logout_redirect_uri: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let params = await validate(url.searchParams, LogoutSchema);
	if (isFailure(params)) {
		logger.info("logout_invalid_params");
		return null;
	}

	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");
	let sessionSubject = accessToken ? getSubjectFromAccessToken(accessToken) : undefined;

	let result = await oidc.logout({
		idTokenHint: params.data.id_token_hint,
		postLogoutRedirectUri: params.data.post_logout_redirect_uri,
		sessionSubject,
	});

	// Send back-channel logout tokens to all RPs before deleting sessions
	// Exclude the client that initiated the logout (they already know)
	await sendBackchannelLogoutTokens(result.subjectId, result.clientId);

	if (refreshToken) {
		await Session.deleteById(db(), refreshToken);
	}
	logger.info("logout_success", { subjectId: result.subjectId, sessionId: refreshToken });
	session().unset("accessToken");
	session().unset("refreshToken");

	let redirectUri = result.redirectUri || new URL(href("/authorize"), url.origin).toString();

	return redirectDocument(redirectUri, {
		headers: {
			"Set-Cookie": await sessionStorage.destroySession(session()),
			"Clear-Site-Data": '"*"',
		},
	});
}

export async function action(_: Route.ActionArgs) {
	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");

	if (accessToken && refreshToken) {
		let subjectId = getSubjectFromAccessToken(accessToken);

		// Send back-channel logout tokens before deleting sessions
		await sendBackchannelLogoutTokens(subjectId);

		await Session.deleteById(db(), refreshToken);
		logger.info("logout_success", { subjectId, sessionId: refreshToken });
		session().unset("accessToken");
		session().unset("refreshToken");
	}

	return redirect(href("/authorize"), {
		headers: {
			"Set-Cookie": await sessionStorage.destroySession(session()),
			"Clear-Site-Data": '"*"',
		},
	});
}

export default function Component() {
	let { t } = useTranslation();

	return (
		<Form
			method="POST"
			reloadDocument
			className="mx-auto flex max-w-screen-sm flex-col items-center gap-10 pt-10"
		>
			<header className="sm:mx-auto sm:w-full sm:max-w-lg">
				<h2 className="text-center text-3xl font-bold tracking-tight">{t("logout.title")}</h2>
			</header>

			<Button type="submit" color="danger" className="w-full">
				{t("logout.cta")}
			</Button>
		</Form>
	);
}
