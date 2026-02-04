import { useTranslation } from "react-i18next";
import { Form, href, redirectDocument } from "react-router";
import { z } from "zod";

import { badRequest, notFound, ok, StatusCode } from "~/helpers/response";
import { session } from "~/middleware/session";
import generateCode from "~/services/login/generate-code";
import loginWithCredential from "~/services/login/with-credential";
import startAuthorizationFlow from "~/services/start-authz-flow";

import type { Route } from "./+types/authorize";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let bodyResult = z
		.object({
			response_type: z.literal("code"),
			client_id: z.string().uuid(),
			redirect_uri: z.string().url(),
			state: z.string(),
			provider: z.string().optional(),
		})
		.safeParse(Object.fromEntries(url.searchParams));

	if (bodyResult.success === false) {
		return badRequest({ message: "Invalid request" });
	}

	let searchParams = bodyResult.data;

	let flowResult = await startAuthorizationFlow({
		clientId: searchParams.client_id,
		redirectUri: searchParams.redirect_uri,
	});

	if (flowResult.status === "failure") {
		if (flowResult.error.code === "invalid_client") {
			return notFound({ message: flowResult.error.description });
		}

		return badRequest({ message: flowResult.error.description });
	}

	// SSO: If the user is already logged-in, generate the code and redirect
	// to the redirect_uri with the code, state, and error parameters if any.
	let subjectId = session().get("sub");
	if (subjectId) {
		let result = await generateCode({
			subjectId,
			clientId: flowResult.payload.client.id,
			ip: null,
			ua: request.headers.get("user-agent"),
		});

		let url = new URL(searchParams.redirect_uri);
		url.searchParams.set("state", searchParams.state);

		if (result.status === "failure") {
			url.searchParams.set("error", result.error.code);
			url.searchParams.set("error_description", result.error.description);
			return redirectDocument(url.toString());
		}

		url.searchParams.set("code", result.payload.code);
		return redirectDocument(url.toString());
	}

	session().set("authz", {
		clientId: searchParams.client_id,
		state: searchParams.state,
		redirectUri: searchParams.redirect_uri,
	});

	if (searchParams.provider) {
		return redirectDocument(href("/auth/:provider", { provider: searchParams.provider }));
	}

	return ok({ client: { name: flowResult.payload.client.name } });
}

export async function action({ request }: Route.ActionArgs) {
	let authz = session().get("authz");
	if (!authz) return badRequest({ message: "Invalid request" });

	let formData = await request.formData();

	let bodyResult = z
		.object({
			email: z.string().email(),
			password: z.string().min(8),
			name: z.string().min(1),
			username: z.string().min(1),
		})
		.safeParse(Object.fromEntries(formData));

	if (!bodyResult.success) return badRequest({ message: "Invalid request" });

	let result = await loginWithCredential({
		email: bodyResult.data.email,
		password: bodyResult.data.password,
		name: bodyResult.data.name,
		username: bodyResult.data.username,
		clientId: authz.clientId,
		ip: null,
		ua: request.headers.get("user-agent"),
		redirectUri: authz.redirectUri,
		state: authz.state,
	});

	if (result.status === "failure") {
		return ok({ message: result.error.description });
	}

	session().unset("authz"); // Remove the authz object from the session
	session().set("sub", result.payload.subjectId); // Keep the subject for SSO
	return redirectDocument(result.payload.url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();

	if (loaderData.status === StatusCode.NotFound) {
		return (
			<main className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
					{t("authorize.errors.unauthorizedClient.title")}
				</h1>
				<p>{t("authorize.errors.unauthorizedClient.description")}</p>
			</main>
		);
	}

	if (loaderData.status === StatusCode.BadRequest) {
		return (
			<main className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
					{t("authorize.errors.invalidRequest.title")}
				</h1>
				<p>{t("authorize.errors.invalidRequest.description")}</p>
			</main>
		);
	}

	return (
		<main className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
			<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
				{t("authorize.header.title", { client: loaderData.client.name })}
			</h1>

			<Form method="POST" className="space-y-6 mb-6 hidden">
				<input
					type="text"
					name="name"
					placeholder={t("authorize.forms.credentials.fields.name.placeholder")}
					required
					className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="text"
					name="username"
					placeholder={t("authorize.forms.credentials.fields.username.placeholder")}
					required
					className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="email"
					name="email"
					placeholder={t("authorize.forms.credentials.fields.email.placeholder")}
					required
					className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>

				<input
					type="password"
					name="password"
					placeholder={t("authorize.forms.credentials.fields.password.placeholder")}
					required
					className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>
				<button
					type="submit"
					className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm"
				>
					{t("authorize.forms.credentials.cta")}
				</button>
			</Form>

			<div className="relative my-6 hidden">
				<hr className="border-t border-gray-300 dark:border-gray-600" />
				<span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-4 text-sm text-gray-500 dark:text-gray-400">
					{t("authorize.forms.separator")}
				</span>
			</div>

			<div className="flex gap-4">
				<Form
					action={href("/auth/:provider", { provider: "github" })}
					method="POST"
					className="contents"
				>
					<button
						type="submit"
						className="w-full bg-gray-800 dark:bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
					>
						<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
							/>
						</svg>
						<span>{t("authorize.forms.github.cta")}</span>
					</button>
					<p className="text-sm text-gray-500 text-center mt-2 font-medium dark:text-white hidden">
						{t("authorize.forms.github.reminder")}
					</p>
				</Form>

				<Form
					action={href("/auth/:provider", { provider: "google" })}
					method="POST"
					className="contents"
				>
					<button
						type="submit"
						className="w-full bg-gray-800 dark:bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
					>
						<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
							/>
						</svg>
						<span>{t("authorize.forms.google.cta")}</span>
					</button>
					<p className="text-sm text-gray-500 text-center mt-2 font-medium dark:text-white hidden">
						{t("authorize.forms.google.reminder")}
					</p>
				</Form>
			</div>
		</main>
	);
}
