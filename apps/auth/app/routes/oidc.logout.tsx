import { useTranslation } from "react-i18next";
import { Form, redirectDocument } from "react-router";
import { z } from "zod";

import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Session from "~/models/session";
import oidc from "~/services/oidc";
import { sessionStorage } from "~/session";

import type { Route } from "./+types/oidc.logout";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let searchParams = z
		.object({
			id_token_hint: z.string(),
			post_logout_redirect_uri: z.string().optional(),
		})
		.safeParse(Object.fromEntries(url.searchParams));

	if (!searchParams.success) return null;

	let result = await oidc.logout({
		idTokenHint: searchParams.data.id_token_hint,
		postLogoutRedirectUri: searchParams.data.post_logout_redirect_uri,
		sessionSubject: session().get("sub"),
	});

	await Session.deleteBySubjectId(db(), result.subjectId);
	session().unset("sub");

	return redirectDocument(result.redirectUri, {
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

			<button
				type="submit"
				className="w-full bg-rose-800 dark:bg-rose-700 text-white py-3 rounded-lg hover:bg-rose-900 dark:hover:bg-rose-600 transition-colors duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
			>
				{t("logout.cta")}
			</button>
		</Form>
	);
}
