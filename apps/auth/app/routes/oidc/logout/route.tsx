import { isFailure } from "@pkg/result";
import { Button, Form } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { href, redirect, redirectDocument } from "react-router";
import { z } from "zod";

import { getSubjectFromAccessToken } from "~/helpers/decode-token";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import Session from "~/models/session";
import oidc from "~/services/oidc";
import { sessionStorage } from "~/session";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Logout | Auth" }];
}

let LogoutSchema = z.object({
	id_token_hint: z.string().optional(),
	post_logout_redirect_uri: z.string().optional(),
	// OIDC RP-Initiated Logout 1.0 additional params
	client_id: z.string().uuid().optional(),
	logout_hint: z.string().optional(), // Hint about which user to log out
	ui_locales: z.string().optional(), // Preferred locale for logout page
	state: z.string().optional(), // For correlation
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

	// id_token_hint is required unless we can identify the subject from session
	if (!params.data.id_token_hint && !sessionSubject) {
		logger.info("logout_missing_id_token_hint");
		return null;
	}

	let result = await oidc.logout({
		idTokenHint: params.data.id_token_hint,
		postLogoutRedirectUri: params.data.post_logout_redirect_uri,
		sessionSubject,
		clientId: params.data.client_id,
		state: params.data.state,
	});

	// Send back-channel logout tokens to all RPs before deleting sessions
	// Exclude the client that initiated the logout (they already know)
	await oidc.sendBackchannelLogoutTokens(result.subjectId, result.clientId);

	// Get front-channel logout URLs for iframes
	let frontchannelUrls = await oidc.getFrontchannelLogoutUrls(result.subjectId, result.clientId);

	if (refreshToken) {
		await Session.deleteById(db(), refreshToken);
	}
	logger.info("logout_success", { subjectId: result.subjectId, sessionId: refreshToken });
	session().unset("accessToken");
	session().unset("refreshToken");

	// Build redirect URI with optional state parameter
	let redirectUri = new URL(
		result.redirectUri || new URL(href("/authorize"), url.origin).toString(),
	);
	if (params.data.state) {
		redirectUri.searchParams.set("state", params.data.state);
	}
	let redirectUriString = redirectUri.toString();

	// If there are front-channel logout URLs, render a page with iframes
	// Otherwise, redirect immediately
	if (frontchannelUrls.length > 0) {
		return {
			type: "frontchannel" as const,
			frontchannelUrls,
			redirectUri: redirectUriString,
		};
	}

	return redirectDocument(redirectUriString, {
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
		await oidc.sendBackchannelLogoutTokens(subjectId);

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

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();

	// If loader returned frontchannel logout data, render iframes
	if (loaderData && typeof loaderData === "object" && "type" in loaderData) {
		if (loaderData.type === "frontchannel") {
			return <FrontchannelLogoutPage data={loaderData} />;
		}
	}

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

/**
 * Page that renders hidden iframes for front-channel logout
 * Per OIDC Front-Channel Logout 1.0, iframes load each RP's logout URI
 * then redirect to the post_logout_redirect_uri after a timeout
 */
function FrontchannelLogoutPage({
	data,
}: {
	data: {
		frontchannelUrls: Array<{ clientId: string; url: string }>;
		redirectUri: string;
	};
}) {
	let { t } = useTranslation();

	return (
		<div className="mx-auto flex max-w-screen-sm flex-col items-center gap-6 pt-10">
			<header className="sm:mx-auto sm:w-full sm:max-w-lg">
				<h2 className="text-center text-3xl font-bold tracking-tight">{t("logout.title")}</h2>
				<p className="text-gray-600 dark:text-gray-400 mt-2 text-center">
					{t("logout.signing_out")}
				</p>
			</header>

			{/* Hidden iframes for front-channel logout */}
			<div className="hidden">
				{data.frontchannelUrls.map((item) => (
					<iframe
						key={item.clientId}
						src={item.url}
						title={`Logout ${item.clientId}`}
						sandbox="allow-scripts allow-same-origin"
					/>
				))}
			</div>

			{/* Auto-redirect after iframes have had time to load */}
			<script
				dangerouslySetInnerHTML={{
					__html: `
						// Wait for iframes to load (2 seconds should be enough)
						// Then redirect to the post_logout_redirect_uri
						setTimeout(function() {
							window.location.href = ${JSON.stringify(data.redirectUri)};
						}, 2000);
					`,
				}}
			/>

			{/* Fallback link in case JavaScript is disabled */}
			<noscript>
				<a href={data.redirectUri} className="text-blue-600 hover:text-blue-800 underline">
					Click here to continue
				</a>
			</noscript>

			{/* Loading indicator */}
			<div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
				<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
						fill="none"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				<span>{t("logout.redirecting")}</span>
			</div>
		</div>
	);
}
