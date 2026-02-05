import { getClientIP } from "@pkg/get-client-ip";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { Form, href, redirectDocument } from "react-router";
import { z } from "zod";

import { badRequest, notFound, ok, StatusCode } from "~/helpers/response";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import generateCode from "~/services/login/generate-code";
import loginWithCredential from "~/services/login/with-credential";
import startAuthorizationFlow from "~/services/start-authz-flow";

import type { Route } from "./+types/authorize";

let LoaderSchema = z.object({
	response_type: z.literal("code"),
	client_id: z.string().uuid(),
	redirect_uri: z.string().url(),
	state: z.string(),
	provider: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let result = await validate(url.searchParams, LoaderSchema);
	if (isFailure(result)) {
		logger.warn("authz_request_invalid");
		return badRequest({ message: "Invalid request" });
	}

	let searchParams = result.data;

	let flowResult = await startAuthorizationFlow({
		clientId: searchParams.client_id,
		redirectUri: searchParams.redirect_uri,
	});

	if (flowResult.status === "failure") {
		if (flowResult.error.code === "invalid_client") {
			logger.warn("authz_invalid_client", { clientId: searchParams.client_id });
			return notFound({ message: flowResult.error.description });
		}

		logger.warn("authz_flow_error", { code: flowResult.error.code });
		return badRequest({ message: flowResult.error.description });
	}

	// SSO: If the user is already logged-in, generate the code and redirect
	// to the redirect_uri with the code, state, and error parameters if any.
	let subjectId = session().get("sub");
	if (subjectId) {
		let codeResult = await generateCode({
			subjectId,
			clientId: flowResult.data.client.id,
			ip: getClientIP(request),
			ua: request.headers.get("user-agent"),
		});

		let url = new URL(searchParams.redirect_uri);
		url.searchParams.set("state", searchParams.state);

		if (codeResult.status === "failure") {
			logger.error("authz_sso_code_failed", { subjectId, error: codeResult.error.code });
			url.searchParams.set("error", codeResult.error.code);
			url.searchParams.set("error_description", codeResult.error.description);
			return redirectDocument(url.toString());
		}

		logger.info("authz_sso_code_generated", { subjectId, clientId: flowResult.data.client.id });
		url.searchParams.set("code", codeResult.data.code);
		return redirectDocument(url.toString());
	}

	logger.info("authz_session_started", { clientId: searchParams.client_id });
	session().set("authz", {
		clientId: searchParams.client_id,
		state: searchParams.state,
		redirectUri: searchParams.redirect_uri,
	});

	if (searchParams.provider) {
		return redirectDocument(href("/auth/:provider", { provider: searchParams.provider }));
	}

	return ok({ client: { name: flowResult.data.client.name } });
}

let ActionSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	name: z.string().min(1),
	username: z.string().min(1),
});

export async function action({ request }: Route.ActionArgs) {
	let authz = session().get("authz");
	if (!authz) {
		logger.warn("authz_action_missing_session");
		return badRequest({ message: "Invalid request" });
	}

	let result = await validate(request, ActionSchema);
	if (isFailure(result)) {
		logger.warn("authz_action_validation_failed");
		return badRequest({ message: "Invalid request" });
	}

	let loginResult = await loginWithCredential({
		email: result.data.email,
		password: result.data.password,
		name: result.data.name,
		username: result.data.username,
		clientId: authz.clientId,
		ip: getClientIP(request),
		ua: request.headers.get("user-agent"),
		redirectUri: authz.redirectUri,
		state: authz.state,
	});

	if (loginResult.status === "failure") {
		logger.warn("authz_credential_login_failed", {
			email: result.data.email,
			error: loginResult.error.code,
		});
		return ok({ message: loginResult.error.description });
	}

	logger.info("authz_credential_login_success", { subjectId: loginResult.data.subjectId });
	session().unset("authz"); // Remove the authz object from the session
	session().set("sub", loginResult.data.subjectId); // Keep the subject for SSO
	return redirectDocument(loginResult.data.url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();

	if (loaderData.status === StatusCode.NotFound) {
		return (
			<main className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
				<h1 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
					{t("authorize.errors.unauthorizedClient.title")}
				</h1>
				<p>{t("authorize.errors.unauthorizedClient.description")}</p>
			</main>
		);
	}

	if (loaderData.status === StatusCode.BadRequest) {
		return (
			<main className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
				<h1 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
					{t("authorize.errors.invalidRequest.title")}
				</h1>
				<p>{t("authorize.errors.invalidRequest.description")}</p>
			</main>
		);
	}

	return (
		<main className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
			<h1 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
				{t("authorize.header.title", { client: loaderData.client.name })}
			</h1>

			<Form method="POST" className="mb-6 hidden space-y-6">
				<input
					type="text"
					name="name"
					placeholder={t("authorize.forms.credentials.fields.name.placeholder")}
					required
					className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="text"
					name="username"
					placeholder={t("authorize.forms.credentials.fields.username.placeholder")}
					required
					className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="email"
					name="email"
					placeholder={t("authorize.forms.credentials.fields.email.placeholder")}
					required
					className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="password"
					name="password"
					placeholder={t("authorize.forms.credentials.fields.password.placeholder")}
					required
					className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>
				<button
					type="submit"
					className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
				>
					{t("authorize.forms.credentials.cta")}
				</button>
			</Form>

			<div className="relative my-6 hidden">
				<hr className="border-t border-gray-300 dark:border-gray-600" />
				<span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
					{t("authorize.forms.separator")}
				</span>
			</div>

			<Form action={href("/auth/:provider", { provider: "github" })} method="POST">
				<button
					type="submit"
					className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 py-3 font-medium text-white shadow-sm transition-colors duration-200 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
				>
					<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
						/>
					</svg>
					<span>{t("authorize.forms.github.cta")}</span>
				</button>
			</Form>
		</main>
	);
}
