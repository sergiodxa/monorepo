import { getClientIP } from "@pkg/get-client-ip";
import { badRequest, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { Button, Card, Form, Heading, Input, Logo, Separator, Text, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { href, redirect, redirectDocument } from "react-router";
import { z } from "zod";

import { AUTH_SERVER_CLIENT_ID, ISSUER, SCOPES_SUPPORTED, type SupportedScope } from "~/config";
import { getSubjectFromAccessToken } from "~/helpers/decode-token";
import { formPostResponse } from "~/helpers/form-post";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import Client from "~/models/client";
import { checkRateLimit, rateLimitResponse } from "~/modules/rate-limit";
import generateAuthzCode from "~/services/login/generate-code";
import loginWithCredential from "~/services/login/with-credential";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Sign In | Auth" }];
}

// Supported prompt values per OIDC specs
const PROMPT_VALUES = ["none", "login", "consent", "select_account", "create"] as const;
type PromptValue = (typeof PROMPT_VALUES)[number];

let LoaderSchema = z.object({
	response_type: z.literal("code"),
	client_id: z.string().uuid(),
	redirect_uri: z.string().url(),
	state: z.string(),
	scope: z
		.string()
		.optional()
		.transform((s) => {
			if (!s) return ["openid"] as SupportedScope[];
			// Parse space-separated scopes and filter to supported ones
			let requested = s.split(" ");
			return requested.filter((scope): scope is SupportedScope =>
				SCOPES_SUPPORTED.includes(scope as SupportedScope),
			);
		}),
	nonce: z.string().optional(), // OIDC nonce for replay protection
	response_mode: z.enum(["query", "fragment", "form_post"]).optional().default("query"),
	prompt: z
		.string()
		.optional()
		.transform((p) => {
			if (!p) return undefined;
			// prompt can have multiple space-separated values
			let values = p
				.split(" ")
				.filter((v): v is PromptValue => PROMPT_VALUES.includes(v as PromptValue));
			return values.length > 0 ? values : undefined;
		}),
	provider: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	// Rate limit by IP address to prevent enumeration attacks
	let ip = getClientIP(request) ?? "unknown";
	if (!(await checkRateLimit("AUTHORIZE_RATE_LIMITER", ip))) {
		return rateLimitResponse();
	}

	// Check if user is already logged in (has valid access token)
	let accessToken = session().get("accessToken");
	let subjectId: string | null = null;
	if (accessToken) {
		try {
			subjectId = getSubjectFromAccessToken(accessToken);
		} catch {
			// Invalid token, clear it
			session().unset("accessToken");
			session().unset("refreshToken");
		}
	}

	let result = await validate(url.searchParams, LoaderSchema);

	// No OAuth params - redirect to self with auth server's own OAuth params
	if (isFailure(result)) {
		// Already logged in, redirect to sessions page
		if (subjectId) {
			logger.info("authz_already_logged_in", { subjectId });
			return redirect(href("/account/sessions"));
		}

		// Get or create the auth server client
		let client = await Client.ensureAuthServerClient(db(), url);

		// Generate state for CSRF protection
		let state = crypto.randomUUID();

		// Store authz in session for the OAuth flow
		session().set("authz", {
			clientId: client.id,
			state,
			redirectUri: client.redirectUri,
		});

		// Redirect to self with proper OAuth params
		let authUrl = new URL("/authorize", url.origin);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set("client_id", AUTH_SERVER_CLIENT_ID);
		authUrl.searchParams.set("redirect_uri", client.redirectUri);
		authUrl.searchParams.set("state", state);

		logger.info("authz_self_redirect", { clientId: AUTH_SERVER_CLIENT_ID });
		return redirect(authUrl.toString());
	}

	let searchParams = result.data;
	let prompt = searchParams.prompt;

	// Validate client and redirect URI
	let client = await Client.findById(db(), searchParams.client_id);
	if (!client) {
		logger.info("authz_invalid_client", { clientId: searchParams.client_id });
		return notFound({ message: "Client not found" });
	}

	if (client.redirectUri !== searchParams.redirect_uri) {
		logger.info("authz_redirect_uri_mismatch", { clientId: searchParams.client_id });
		return notFound({ message: "Invalid redirect URI" });
	}

	// Helper to build error redirect response
	let errorRedirect = (error: string, description: string) => {
		let params: Record<string, string> = {
			state: searchParams.state,
			iss: ISSUER,
			error,
			error_description: description,
		};

		if (searchParams.response_mode === "form_post") {
			return formPostResponse(searchParams.redirect_uri, params);
		}

		let redirectUrl = new URL(searchParams.redirect_uri);
		for (let [key, value] of Object.entries(params)) {
			redirectUrl.searchParams.set(key, value);
		}
		return redirectDocument(redirectUrl.toString());
	};

	// Handle prompt=none: user must be logged in, no UI interaction
	if (prompt?.includes("none")) {
		if (!subjectId) {
			logger.info("authz_prompt_none_login_required");
			return errorRedirect("login_required", "User is not authenticated");
		}
	}

	// Handle prompt=login: force re-authentication, skip SSO even if logged in
	let forceLogin = prompt?.includes("login");

	// SSO: If the user is already logged-in and not forcing login, generate the code
	// and redirect to the redirect_uri with the code, state, and error parameters if any.
	if (subjectId && !forceLogin) {
		let codeResult = await generateAuthzCode({
			subjectId,
			clientId: client.id,
			ip: getClientIP(request),
			ua: request.headers.get("user-agent"),
			redirectUri: searchParams.redirect_uri,
			state: searchParams.state,
			nonce: searchParams.nonce,
			scope: searchParams.scope,
			responseMode: searchParams.response_mode,
		});

		if (codeResult.status === "failure") {
			logger.error("authz_sso_code_failed", { subjectId, error: codeResult.error.code });
			return errorRedirect(codeResult.error.code, codeResult.error.description);
		}

		logger.info("authz_sso_code_generated", { subjectId, clientId: client.id });

		// Return response based on response_mode
		if (codeResult.data.responseMode === "form_post") {
			return formPostResponse(codeResult.data.redirectUri, codeResult.data.params);
		}

		let redirectUrl = new URL(codeResult.data.redirectUri);
		for (let [key, value] of Object.entries(codeResult.data.params)) {
			redirectUrl.searchParams.set(key, value);
		}
		return redirectDocument(redirectUrl.toString());
	}

	logger.info("authz_session_started", { clientId: searchParams.client_id });
	session().set("authz", {
		clientId: searchParams.client_id,
		state: searchParams.state,
		redirectUri: searchParams.redirect_uri,
		nonce: searchParams.nonce,
		scope: searchParams.scope,
		responseMode: searchParams.response_mode,
		prompt,
	});

	if (searchParams.provider) {
		return redirectDocument(href("/auth/:provider", { provider: searchParams.provider }));
	}

	// prompt=create shows registration form prominently
	let showRegistration = prompt?.includes("create") ?? false;

	return ok({
		client: {
			name: client.name,
			description: client.description,
			logoUrl: client.logoUrl,
		},
		showRegistration,
	});
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
		logger.info("authz_action_missing_session");
		return badRequest({ message: "Invalid request" });
	}

	let result = await validate(request, ActionSchema);
	if (isFailure(result)) {
		logger.info("authz_action_validation_failed");
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
		nonce: authz.nonce,
		scope: authz.scope,
		responseMode: authz.responseMode,
	});

	if (loginResult.status === "failure") {
		logger.info("authz_credential_login_failed", {
			email: result.data.email,
			error: loginResult.error.code,
		});
		return ok({ message: loginResult.error.description });
	}

	logger.info("authz_credential_login_success", { subjectId: loginResult.data.subjectId });
	session().unset("authz");

	// Handle form_post response mode
	if (loginResult.data.responseMode === "form_post") {
		return formPostResponse(loginResult.data.redirectUri, loginResult.data.params);
	}

	// Default: query response mode
	let url = new URL(loginResult.data.redirectUri);
	for (let [key, value] of Object.entries(loginResult.data.params)) {
		url.searchParams.set(key, value);
	}
	return redirectDocument(url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();

	// Error state (invalid client, etc.)
	if (!loaderData.ok) {
		return (
			<main className="grid min-h-dvh w-full lg:grid-cols-2">
				<ClientPanel client={{ name: t("authorize.errors.invalidRequest.title") }} />
				<LoginPanel>
					<Card.Header>
						<Card.Title>{t("authorize.errors.invalidRequest.title")}</Card.Title>
						<Card.Description>{t("authorize.errors.invalidRequest.description")}</Card.Description>
					</Card.Header>
				</LoginPanel>
			</main>
		);
	}

	return (
		<main className="grid min-h-dvh w-full lg:grid-cols-2">
			<ClientPanel client={loaderData.client} />
			<LoginPanel>
				<Card.Header className="text-center">
					<Card.Title>
						<span className="lg:hidden">
							{t("authorize.header.title", { client: loaderData.client.name })}
						</span>
						<span className="hidden lg:inline">{t("authorize.header.titleShort")}</span>
					</Card.Title>
					<Card.Description>{t("authorize.header.description")}</Card.Description>
				</Card.Header>

				<Card.Content className="flex flex-col gap-4">
					{/* Registration form - shown when prompt=create, hidden otherwise */}
					<Form
						method="POST"
						className={
							loaderData.showRegistration ? "flex flex-col gap-6" : "hidden flex-col gap-6"
						}
					>
						<TextField name="name" isRequired>
							<Input
								placeholder={t("authorize.forms.credentials.fields.name.placeholder")}
								className="w-full"
							/>
						</TextField>

						<TextField name="username" isRequired>
							<Input
								placeholder={t("authorize.forms.credentials.fields.username.placeholder")}
								className="w-full"
							/>
						</TextField>

						<TextField name="email" type="email" isRequired>
							<Input
								placeholder={t("authorize.forms.credentials.fields.email.placeholder")}
								className="w-full"
							/>
						</TextField>

						<TextField name="password" type="password" isRequired>
							<Input
								placeholder={t("authorize.forms.credentials.fields.password.placeholder")}
								className="w-full"
							/>
						</TextField>

						<Button type="submit" color="primary" className="w-full">
							{t("authorize.forms.credentials.cta")}
						</Button>
					</Form>

					{/* Separator - shown when registration form is visible */}
					<div
						className={
							loaderData.showRegistration
								? "relative flex items-center"
								: "relative hidden items-center"
						}
					>
						<Separator className="flex-1" />
						<Text slot="description" className="px-4">
							{t("authorize.forms.separator")}
						</Text>
						<Separator className="flex-1" />
					</div>

					<Form action={href("/auth/:provider", { provider: "github" })} method="POST">
						<Button
							type="submit"
							color="neutral"
							className="flex w-full items-center justify-center gap-2"
						>
							<svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								/>
							</svg>
							<span>{t("authorize.forms.github.cta")}</span>
						</Button>
					</Form>
				</Card.Content>
			</LoginPanel>
		</main>
	);
}

function ClientPanel({
	client,
}: {
	client: { name: string; description?: string | null; logoUrl?: string | null };
}) {
	return (
		<aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-100 p-12 text-neutral-900 lg:flex dark:bg-neutral-800 dark:text-neutral-100">
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<Logo size="md">
						{client.logoUrl ? (
							<Logo.Image src={client.logoUrl} alt={client.name} />
						) : (
							<Logo.Fallback className="bg-neutral-200 dark:bg-neutral-700">
								{client.name.charAt(0).toUpperCase()}
							</Logo.Fallback>
						)}
					</Logo>
					<Heading level={2} className="text-xl font-semibold">
						{client.name}
					</Heading>
				</div>
				{client.description && (
					<Text className="max-w-sm text-neutral-600 dark:text-neutral-400">
						{client.description}
					</Text>
				)}
			</div>

			<ConcentricRings />
		</aside>
	);
}

function ConcentricRings() {
	return (
		<svg className="absolute bottom-0 left-0 h-150 w-150" viewBox="0 0 600 600" aria-hidden="true">
			{/* Same color/opacity for all - the overlapping creates the gradient effect */}
			<circle cx="0" cy="600" r="560" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="490" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="420" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="350" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="280" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="210" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="140" className="fill-primary-500/5 dark:fill-primary-400/5" />
			<circle cx="0" cy="600" r="70" className="fill-primary-500/5 dark:fill-primary-400/5" />
		</svg>
	);
}

function LoginPanel({ children }: { children: React.ReactNode }) {
	return (
		<section className="flex flex-col items-center justify-center bg-neutral-50 p-6 pt-[15vh] md:p-10 md:pt-[20vh] lg:pt-0 dark:bg-neutral-900">
			<Card className="w-full max-w-90">{children}</Card>
		</section>
	);
}
