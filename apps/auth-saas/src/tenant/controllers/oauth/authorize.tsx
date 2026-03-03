import type { RemixNode } from "remix/component";

import { ok } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";

import form from "~/lib/form";
import { Layout } from "~/tenant/components/layout";
import Client from "~/tenant/models/client";
import RedirectUri from "~/tenant/models/client/redirect-uri";
import Passkey from "~/tenant/models/passkey";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import WebAuthnChallenge from "~/tenant/models/webauthn-challenge";
import routes from "~/tenant/routes";

// OAuth 2.0 Authorization Request parameters
// Note: `state` is required for CSRF protection per RFC 6749 Section 10.12
let AuthorizeRequestSchema = s.object({
	response_type: s.enum_(["code"]),
	client_id: s.string(),
	redirect_uri: s.string(),
	scope: s.optional(s.string()),
	state: s.string(), // Required for CSRF protection
	nonce: s.optional(s.string()),
	code_challenge: s.optional(s.string()),
	code_challenge_method: s.optional(s.enum_(["S256", "plain"])),
	prompt: s.optional(s.enum_(["none", "login", "consent", "select_account"])),
	login_hint: s.optional(s.string()),
});

let LoginFormSchema = s.object({
	email: s.string(),
	// OAuth params passed through
	client_id: s.string(),
	redirect_uri: s.string(),
	scope: s.optional(s.string()),
	state: s.optional(s.string()),
	nonce: s.optional(s.string()),
	code_challenge: s.optional(s.string()),
	code_challenge_method: s.optional(s.string()),
	// Action type
	action: s.enum_(["check_email", "register", "authenticate"]),
});

export default form<"/authorize">({
	middleware: [],

	actions: {
		// GET /authorize - Show login form or validate OAuth params
		async index({ db, request, logger }) {
			let log = logger.loader("/authorize");
			let url = new URL(request.url);
			let params = Object.fromEntries(url.searchParams);

			// Validate OAuth parameters
			let result = await validate(params, AuthorizeRequestSchema);
			if (isFailure(result)) {
				log.error("Invalid authorization request", { issues: result.error.issues });
				return renderError("Invalid request parameters");
			}

			let {
				client_id,
				redirect_uri,
				scope,
				state,
				nonce,
				code_challenge,
				code_challenge_method,
				login_hint,
			} = result.data;

			// Validate client exists
			let client = await Client.show(db, client_id);
			if (!client) {
				log.error("Client not found", { client_id });
				return renderError("Invalid client_id");
			}

			// Validate redirect URI
			let isValidRedirect = await RedirectUri.validate(db, client_id, redirect_uri);
			if (!isValidRedirect) {
				log.error("Invalid redirect_uri", { client_id, redirect_uri });
				return renderError("Invalid redirect_uri");
			}

			// Render login form
			log.info("Rendering authorization form", { client_id });
			let body = await renderToString(
				<LoginForm
					clientName={client.name}
					clientLogo={client.logo_url}
					clientId={client_id}
					redirectUri={redirect_uri}
					scope={scope}
					state={state}
					nonce={nonce}
					codeChallenge={code_challenge}
					codeChallengeMethod={code_challenge_method}
					loginHint={login_hint}
				/>,
			);
			return ok(body);
		},

		// POST /authorize - Handle login form submission
		async action({ db, formData, request, logger }) {
			let log = logger.action("/authorize");
			let body = Object.fromEntries(formData);

			let result = await validate(body, LoginFormSchema);
			if (isFailure(result)) {
				log.error("Invalid form submission", { issues: result.error.issues });
				return renderError("Invalid form data");
			}

			let {
				email,
				client_id,
				redirect_uri,
				scope,
				state,
				nonce,
				code_challenge,
				code_challenge_method,
				action,
			} = result.data;

			// Validate client
			let client = await Client.show(db, client_id);
			if (!client) {
				return renderError("Invalid client");
			}

			// Validate redirect URI
			let isValidRedirect = await RedirectUri.validate(db, client_id, redirect_uri);
			if (!isValidRedirect) {
				return renderError("Invalid redirect_uri");
			}

			// Get tenant issuer for RP ID
			let issuer = await TenantMeta.getIssuer(db);
			let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;

			if (action === "check_email") {
				// Check if user exists and has passkeys
				let subject = await Subject.findByEmail(db, email);
				let hasPasskeys = false;

				if (subject) {
					let passkeys = await Passkey.listBySubject(db, subject.id);
					hasPasskeys = passkeys.length > 0;
				}

				if (hasPasskeys && subject) {
					// User has passkeys - show authentication UI
					let { id: challengeId, challenge } = await WebAuthnChallenge.createForAuthentication(db, {
						subjectId: subject.id,
						clientId: client_id,
						redirectUri: redirect_uri,
						state,
						nonce,
						scope,
					});

					let passkeys = await Passkey.listBySubject(db, subject.id);
					let allowCredentials = passkeys.map((p) => ({
						id: p.id,
						type: "public-key" as const,
						transports: p.transports?.split(",") as AuthenticatorTransport[] | undefined,
					}));

					let html = await renderToString(
						<AuthenticateForm
							email={email}
							challengeId={challengeId}
							challenge={challenge}
							rpId={rpId}
							allowCredentials={allowCredentials}
							clientName={client.name}
						/>,
					);
					return ok(html);
				} else {
					// User doesn't exist or has no passkeys - show registration UI
					let { id: challengeId, challenge } = await WebAuthnChallenge.createForRegistration(db, {
						email,
						clientId: client_id,
						redirectUri: redirect_uri,
						state,
						nonce,
						scope,
					});

					let html = await renderToString(
						<RegisterForm
							email={email}
							challengeId={challengeId}
							challenge={challenge}
							rpId={rpId}
							rpName={client.name}
							clientName={client.name}
						/>,
					);
					return ok(html);
				}
			}

			// Fallback - show initial form again
			let html = await renderToString(
				<LoginForm
					clientName={client.name}
					clientLogo={client.logo_url}
					clientId={client_id}
					redirectUri={redirect_uri}
					scope={scope}
					state={state}
					nonce={nonce}
					codeChallenge={code_challenge}
					codeChallengeMethod={code_challenge_method}
					loginHint={email}
					error="Please enter your email to continue"
				/>,
			);
			return ok(html);
		},
	},
});

async function renderError(message: string) {
	let html = await renderToString(<ErrorPage message={message} />);
	return ok(html);
}

function ErrorPage() {
	return ({ message }: { message: string }) => (
		<Layout>
			<div
				css={{
					maxWidth: "400px",
					margin: "2rem auto",
					padding: "2rem",
					backgroundColor: "#FEF2F2",
					borderRadius: "0.5rem",
					border: "1px solid #FECACA",
				}}
			>
				<h1 css={{ color: "#DC2626", marginBottom: "1rem" }}>Error</h1>
				<p css={{ color: "#991B1B" }}>{message}</p>
			</div>
		</Layout>
	);
}

interface LoginFormProps {
	clientName: string;
	clientLogo: string | null;
	clientId: string;
	redirectUri: string;
	scope?: string;
	state?: string;
	nonce?: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	loginHint?: string;
	error?: string;
}

function LoginForm() {
	return (props: LoginFormProps) => (
		<Layout>
			<div
				css={{
					maxWidth: "400px",
					margin: "2rem auto",
					padding: "2rem",
					backgroundColor: "white",
					borderRadius: "0.5rem",
					boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
				}}
			>
				<div css={{ textAlign: "center", marginBottom: "2rem" }}>
					{props.clientLogo && (
						<img
							src={props.clientLogo}
							alt={props.clientName}
							css={{
								width: "64px",
								height: "64px",
								borderRadius: "0.5rem",
								marginBottom: "1rem",
							}}
						/>
					)}
					<h1 css={{ fontSize: "1.5rem", fontWeight: "600" }}>Sign in to {props.clientName}</h1>
					<p css={{ color: "#6B7280", marginTop: "0.5rem" }}>Enter your email to continue</p>
				</div>

				{props.error && (
					<div
						css={{
							padding: "0.75rem",
							backgroundColor: "#FEF2F2",
							borderRadius: "0.375rem",
							marginBottom: "1rem",
							color: "#DC2626",
							fontSize: "0.875rem",
						}}
					>
						{props.error}
					</div>
				)}

				<form
					method={routes.oauth.authorize.action.method}
					action={routes.oauth.authorize.action.href()}
				>
					<input type="hidden" name="client_id" value={props.clientId} />
					<input type="hidden" name="redirect_uri" value={props.redirectUri} />
					{props.scope && <input type="hidden" name="scope" value={props.scope} />}
					{props.state && <input type="hidden" name="state" value={props.state} />}
					{props.nonce && <input type="hidden" name="nonce" value={props.nonce} />}
					{props.codeChallenge && (
						<input type="hidden" name="code_challenge" value={props.codeChallenge} />
					)}
					{props.codeChallengeMethod && (
						<input type="hidden" name="code_challenge_method" value={props.codeChallengeMethod} />
					)}
					<input type="hidden" name="action" value="check_email" />

					<div css={{ marginBottom: "1rem" }}>
						<label
							htmlFor="email"
							css={{
								display: "block",
								fontSize: "0.875rem",
								fontWeight: "500",
								marginBottom: "0.25rem",
							}}
						>
							Email address
						</label>
						<input
							type="email"
							id="email"
							name="email"
							required
							autoComplete="email"
							defaultValue={props.loginHint}
							css={{
								width: "100%",
								padding: "0.75rem",
								border: "1px solid #D1D5DB",
								borderRadius: "0.375rem",
								fontSize: "1rem",
								"&:focus": {
									outline: "none",
									borderColor: "#3B82F6",
									boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
								},
							}}
						/>
					</div>

					<button
						type="submit"
						css={{
							width: "100%",
							padding: "0.75rem",
							backgroundColor: "#3B82F6",
							color: "white",
							border: "none",
							borderRadius: "0.375rem",
							fontSize: "1rem",
							fontWeight: "500",
							cursor: "pointer",
							"&:hover": {
								backgroundColor: "#2563EB",
							},
						}}
					>
						Continue
					</button>
				</form>
			</div>
		</Layout>
	);
}

interface AuthenticateFormProps {
	email: string;
	challengeId: string;
	challenge: string;
	rpId: string;
	allowCredentials: Array<{
		id: string;
		type: "public-key";
		transports?: AuthenticatorTransport[];
	}>;
	clientName: string;
}

function AuthenticateForm() {
	return (props: AuthenticateFormProps) => (
		<Layout>
			<div
				css={{
					maxWidth: "400px",
					margin: "2rem auto",
					padding: "2rem",
					backgroundColor: "white",
					borderRadius: "0.5rem",
					boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
					textAlign: "center",
				}}
			>
				<h1 css={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
					Sign in to {props.clientName}
				</h1>
				<p css={{ color: "#6B7280", marginBottom: "2rem" }}>
					Use your passkey to sign in as <strong>{props.email}</strong>
				</p>

				<div id="webauthn-auth">
					<noscript>
						<p css={{ color: "#DC2626" }}>JavaScript is required for passkey authentication.</p>
					</noscript>
				</div>

				<WebAuthnScript
					type="authenticate"
					challengeId={props.challengeId}
					challenge={props.challenge}
					rpId={props.rpId}
					allowCredentials={props.allowCredentials}
				/>
			</div>
		</Layout>
	);
}

interface RegisterFormProps {
	email: string;
	challengeId: string;
	challenge: string;
	rpId: string;
	rpName: string;
	clientName: string;
}

function RegisterForm() {
	return (props: RegisterFormProps) => (
		<Layout>
			<div
				css={{
					maxWidth: "400px",
					margin: "2rem auto",
					padding: "2rem",
					backgroundColor: "white",
					borderRadius: "0.5rem",
					boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
					textAlign: "center",
				}}
			>
				<h1 css={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
					Create your account
				</h1>
				<p css={{ color: "#6B7280", marginBottom: "2rem" }}>
					Create a passkey for <strong>{props.email}</strong>
				</p>

				<div id="webauthn-register">
					<noscript>
						<p css={{ color: "#DC2626" }}>JavaScript is required for passkey registration.</p>
					</noscript>
				</div>

				<WebAuthnScript
					type="register"
					challengeId={props.challengeId}
					challenge={props.challenge}
					rpId={props.rpId}
					rpName={props.rpName}
					email={props.email}
				/>
			</div>
		</Layout>
	);
}

interface WebAuthnScriptProps {
	type: "authenticate" | "register";
	challengeId: string;
	challenge: string;
	rpId: string;
	allowCredentials?: Array<{
		id: string;
		type: "public-key";
		transports?: AuthenticatorTransport[];
	}>;
	rpName?: string;
	email?: string;
}

function WebAuthnScript() {
	return (props: WebAuthnScriptProps): RemixNode => {
		// Script data is passed via data attributes and executed by the client entry script
		return (
			<div id="webauthn-script-container">
				{/* Script will be injected client-side via the entry script */}
				<script
					id="webauthn-data"
					type="application/json"
					data-type={props.type}
					data-challenge-id={props.challengeId}
					data-challenge={props.challenge}
					data-rp-id={props.rpId}
					data-rp-name={props.rpName}
					data-email={props.email}
					data-allow-credentials={
						props.allowCredentials ? JSON.stringify(props.allowCredentials) : undefined
					}
				/>
			</div>
		);
	};
}
