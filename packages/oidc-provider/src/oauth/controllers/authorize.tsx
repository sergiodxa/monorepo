/**
 * OAuth 2.0 Authorization Endpoint controller and its server-rendered UI.
 *
 * Renders the email/passkey sign-in flow: validates the authorization request,
 * checks whether the email already has passkeys, and shows the WebAuthn
 * authentication or registration form (carrying the pending OAuth parameters).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ok } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";
import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";

import { WebAuthnAuth } from "../../client/webauthn-auth";
import { WebAuthnRegister } from "../../client/webauthn-register";
import Client from "../../clients/models/client";
import RedirectUri from "../../clients/models/redirect-uri";
import TenantMeta from "../../management/models/tenant-meta";
import routes from "../../routes";
import { Layout } from "../../shared/layout";
import Subject from "../../subjects/models/subject";
import Passkey from "../../webauthn/models/passkey";
import WebAuthnChallenge from "../../webauthn/models/webauthn-challenge";

/**
 * OAuth 2.0 Authorization Request parameters per RFC 6749.
 * The `state` parameter is required per RFC 6749 Section 10.12 to prevent CSRF attacks.
 */
let AuthorizeRequestSchema = s.object({
	response_type: s.enum_(["code"]),
	client_id: s.string(),
	redirect_uri: s.string(),
	scope: s.optional(s.string()),
	state: s.string(),
	nonce: s.optional(s.string()),
	code_challenge: s.optional(s.string()),
	code_challenge_method: s.optional(s.enum_(["S256", "plain"])),
	prompt: s.optional(s.enum_(["none", "login", "consent", "select_account"])),
	login_hint: s.optional(s.string()),
});

/** Validation schema for the sign-in form POST that carries the OAuth parameters. */
let LoginFormSchema = s.object({
	email: s.string(),
	client_id: s.string(),
	redirect_uri: s.string(),
	scope: s.optional(s.string()),
	state: s.optional(s.string()),
	nonce: s.optional(s.string()),
	code_challenge: s.optional(s.string()),
	code_challenge_method: s.optional(s.string()),
	action: s.enum_(["check_email", "register", "authenticate"]),
});

/**
 * OAuth 2.0 Authorization Endpoint (RFC 6749 Section 3.1).
 * Handles the authorization code flow with PKCE support.
 *
 * `index` (GET) validates the request and renders the email form; `action` (POST)
 * processes the email and renders the passkey authentication or registration form.
 */
export default createController(routes.oauth.authorize, {
	middleware: [],

	actions: {
		index: inject([Database] as const, async (db) => {
			let { request, logger } = getContext();
			let log = logger.loader("/authorize");
			let url = new URL(request.url);
			let params = Object.fromEntries(url.searchParams);

			// If no params provided, redirect to onboarding to start the OAuth flow
			if (url.searchParams.size === 0) {
				log.info("No params provided, redirecting to onboarding");
				return new Response(null, {
					status: 302,
					headers: { Location: "/onboarding" },
				});
			}

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

			let client = await Client.show(db, client_id);
			if (!client) {
				log.error("Client not found", { client_id });
				return renderError("Invalid client_id");
			}

			let isValidRedirect = await RedirectUri.validate(db, client_id, redirect_uri);
			if (!isValidRedirect) {
				log.error("Invalid redirect_uri", { client_id, redirect_uri });
				return renderError("Invalid redirect_uri");
			}

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
		}),

		action: inject([Database] as const, async (db) => {
			let { formData, request, logger } = getContext();
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

			let client = await Client.show(db, client_id);
			if (!client) {
				return renderError("Invalid client");
			}

			let isValidRedirect = await RedirectUri.validate(db, client_id, redirect_uri);
			if (!isValidRedirect) {
				return renderError("Invalid redirect_uri");
			}

			let issuer = await TenantMeta.getIssuer(db);
			let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;

			if (action === "check_email") {
				let subject = await Subject.findByEmail(db, email);
				// Only consider passkeys with credential_id (legacy passkeys without it are unusable)
				let allPasskeys = subject ? await Passkey.listBySubject(db, subject.id) : [];
				let validPasskeys = allPasskeys.filter((p) => p.credential_id);

				log.info("Checking passkeys for email", {
					email,
					subjectId: subject?.id,
					totalPasskeys: allPasskeys.length,
					validPasskeys: validPasskeys.length,
					hasCredentialIds: allPasskeys.map((p) => !!p.credential_id),
				});

				if (validPasskeys.length > 0 && subject) {
					let { id: challengeId, challenge } = await WebAuthnChallenge.createForAuthentication(db, {
						subjectId: subject.id,
						clientId: client_id,
						redirectUri: redirect_uri,
						state,
						nonce,
						scope,
						pkce:
							code_challenge && code_challenge_method
								? { challenge: code_challenge, method: code_challenge_method as "S256" | "plain" }
								: undefined,
					});

					let allowCredentials = validPasskeys.map((p) => {
						let transports = p.transports
							? (p.transports.split(",") as AuthenticatorTransport[])
							: (["internal"] as AuthenticatorTransport[]);
						// If "internal" is present, only use that to avoid Safari showing QR code
						if (transports.includes("internal")) {
							transports = ["internal"];
						}
						return {
							id: p.credential_id!, // Already filtered for non-null credential_id
							type: "public-key" as const,
							transports,
						};
					});

					log.info("Rendering authentication form", {
						email,
						rpId,
						credentialCount: allowCredentials.length,
						credentialIds: allowCredentials.map((c) => c.id.substring(0, 20) + "..."),
						transports: allowCredentials.map((c) => c.transports),
					});

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
					let {
						id: challengeId,
						challenge,
						userId,
					} = await WebAuthnChallenge.createForRegistration(db, {
						email,
						clientId: client_id,
						redirectUri: redirect_uri,
						state,
						nonce,
						scope,
						pkce:
							code_challenge && code_challenge_method
								? { challenge: code_challenge, method: code_challenge_method as "S256" | "plain" }
								: undefined,
					});

					let html = await renderToString(
						<RegisterForm
							email={email}
							userId={userId}
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
		}),
	},
});

/**
 * Renders the error page to an HTML `Response`.
 * @param message - User-facing error message to display.
 * @returns An HTML `Response` (status 200) containing the error page.
 */
async function renderError(message: string) {
	let html = await renderToString(<ErrorPage message={message} />);
	return ok(html);
}

/**
 * Full-page error view shown when the authorization request is invalid.
 * @param handle - Component handle exposing the error `message`.
 * @returns A render function producing the error markup.
 */
function ErrorPage(handle: Handle<{ message: string }>) {
	return () => (
		<Layout>
			<div
				mix={[
					css({
						maxWidth: "400px",
						margin: "2rem auto",
						padding: "2rem",
						backgroundColor: "#FEF2F2",
						borderRadius: "0.5rem",
						border: "1px solid #FECACA",
					}),
				]}
			>
				<h1 mix={[css({ color: "#DC2626", marginBottom: "1rem" })]}>Error</h1>
				<p mix={[css({ color: "#991B1B" })]}>{handle.props.message}</p>
			</div>
		</Layout>
	);
}

/** Props for the login form component. */
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

/**
 * Email entry form that begins the sign-in flow, preserving OAuth parameters as
 * hidden fields.
 * @param handle - Component handle exposing the login form props.
 * @returns A render function producing the form markup.
 */
function LoginForm(handle: Handle<LoginFormProps>) {
	let props = handle.props;
	return () => (
		<Layout>
			<div
				mix={[
					css({
						maxWidth: "400px",
						margin: "2rem auto",
						padding: "2rem",
						backgroundColor: "white",
						borderRadius: "0.5rem",
						boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
					}),
				]}
			>
				<div mix={[css({ textAlign: "center", marginBottom: "2rem" })]}>
					{props.clientLogo && (
						<img
							src={props.clientLogo}
							alt={props.clientName}
							mix={[
								css({
									width: "64px",
									height: "64px",
									borderRadius: "0.5rem",
									marginBottom: "1rem",
								}),
							]}
						/>
					)}
					<h1 mix={[css({ fontSize: "1.5rem", fontWeight: "600" })]}>
						Sign in to {props.clientName}
					</h1>
					<p mix={[css({ color: "#6B7280", marginTop: "0.5rem" })]}>Enter your email to continue</p>
				</div>

				{props.error && (
					<div
						mix={[
							css({
								padding: "0.75rem",
								backgroundColor: "#FEF2F2",
								borderRadius: "0.375rem",
								marginBottom: "1rem",
								color: "#DC2626",
								fontSize: "0.875rem",
							}),
						]}
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

					<div mix={[css({ marginBottom: "1rem" })]}>
						<label
							htmlFor="email"
							mix={[
								css({
									display: "block",
									fontSize: "0.875rem",
									fontWeight: "500",
									marginBottom: "0.25rem",
								}),
							]}
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
							mix={[
								css({
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
								}),
							]}
						/>
					</div>

					<button
						type="submit"
						mix={[
							css({
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
							}),
						]}
					>
						Continue
					</button>
				</form>
			</div>
		</Layout>
	);
}

/** Props for the WebAuthn authentication form. */
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

/**
 * Passkey sign-in view that mounts the {@link WebAuthnAuth} client component.
 * @param handle - Component handle exposing the authentication form props.
 * @returns A render function producing the form markup.
 */
function AuthenticateForm(handle: Handle<AuthenticateFormProps>) {
	let props = handle.props;
	return () => (
		<Layout>
			<div
				mix={[
					css({
						maxWidth: "400px",
						margin: "2rem auto",
						padding: "2rem",
						backgroundColor: "white",
						borderRadius: "0.5rem",
						boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
						textAlign: "center",
					}),
				]}
			>
				<h1 mix={[css({ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" })]}>
					Sign in to {props.clientName}
				</h1>

				<WebAuthnAuth
					email={props.email}
					challengeId={props.challengeId}
					options={{
						challenge: props.challenge,
						rpId: props.rpId,
						allowCredentials: props.allowCredentials,
						timeout: 60000,
						userVerification: "preferred",
					}}
					verifyUrl={routes.webauthn.auth.verify.href()}
				/>

				<noscript>
					<p mix={[css({ color: "#DC2626" })]}>
						JavaScript is required for passkey authentication.
					</p>
				</noscript>
			</div>
		</Layout>
	);
}

/** Props for the WebAuthn registration form. */
interface RegisterFormProps {
	email: string;
	userId: string;
	challengeId: string;
	challenge: string;
	rpId: string;
	rpName: string;
	clientName: string;
}

/**
 * Passkey enrollment view that mounts the {@link WebAuthnRegister} client component.
 * @param handle - Component handle exposing the registration form props.
 * @returns A render function producing the form markup.
 */
function RegisterForm(handle: Handle<RegisterFormProps>) {
	let props = handle.props;
	return () => (
		<Layout>
			<div
				mix={[
					css({
						maxWidth: "400px",
						margin: "2rem auto",
						padding: "2rem",
						backgroundColor: "white",
						borderRadius: "0.5rem",
						boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
						textAlign: "center",
					}),
				]}
			>
				<h1 mix={[css({ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" })]}>
					Create your account
				</h1>

				<WebAuthnRegister
					email={props.email}
					challengeId={props.challengeId}
					options={{
						challenge: props.challenge,
						rp: {
							id: props.rpId,
							name: props.rpName,
						},
						user: {
							id: props.userId,
							name: props.email,
							displayName: props.email,
						},
						pubKeyCredParams: [
							{ alg: -7, type: "public-key" }, // ES256
							{ alg: -257, type: "public-key" }, // RS256
						],
						timeout: 60000,
						attestation: "none",
						authenticatorSelection: {
							authenticatorAttachment: "platform",
							residentKey: "preferred",
							userVerification: "preferred",
						},
					}}
					verifyUrl={routes.webauthn.register.verify.href()}
				/>

				<noscript>
					<p mix={[css({ color: "#DC2626" })]}>JavaScript is required for passkey registration.</p>
				</noscript>
			</div>
		</Layout>
	);
}
