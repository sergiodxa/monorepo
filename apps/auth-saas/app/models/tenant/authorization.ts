/**
 * The authorization endpoint's whole operation: the `authorization_requests` and
 * `authorization_codes` tables, and `beginAuthorization`/`resumeAuthorization`, which
 * validate a request, resolve whichever session applies, evaluate consent and mint a
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import * as s from "remix/data-schema";
import { and, column as c, eq, gt, inList, isNull, lt, notNull, or, table } from "remix/data-table";

import type { ConsentScreen } from "~/app/models/tenant/consent";
import type { SessionRow } from "~/app/models/tenant/sessions";
import type { StepUpScreen } from "~/app/models/tenant/totp";

import { clients, redirectUriMatches } from "~/app/models/tenant/clients";
import { evaluateConsent } from "~/app/models/tenant/consent";
import {
	redeemPushedAuthorizationRequest,
	requiresPushedAuthorizationRequests,
} from "~/app/models/tenant/pushed-authorization";
import { verifyRequestObject } from "~/app/models/tenant/request-objects";
import { sessions } from "~/app/models/tenant/sessions";
import { describeStepUpScreen } from "~/app/models/tenant/totp";
import { isClientIdUrl, resolveCimdClient } from "~/app/services/tenant/client-id-metadata";

/**
 * The facts about a client this endpoint reads before parking or minting a code,
 * whether the client is a row in the tenant's own table or a document fetched from
 * the URL that names it.
 */
interface AuthorizingClient {
	disabledAt: number | null;
	redirectUris: string[];
	responseTypes: string[];
	scopes: string[];
}

/**
 * Resolves the client an `/authorize` request names: a Client ID Metadata Document,
 * fetched fresh (or from this instance's short-lived cache) for a `client_id` shaped
 * as an `https://` URL, or a row from the tenant's own client table for an opaque id
 */
async function resolveAuthorizingClient(
	db: Database,
	clientId: string,
	now: number,
): Promise<AuthorizingClient | null> {
	if (isClientIdUrl(clientId)) {
		let resolved = await resolveCimdClient(clientId, now);
		if (!resolved.ok) return null;

		return {
			disabledAt: null,
			redirectUris: resolved.client.redirectUris,
			responseTypes: resolved.client.responseTypes,
			scopes: resolved.client.scopes,
		};
	}

	let row = await db.find(clients, { id: clientId });
	if (!row) return null;

	return {
		disabledAt: row.disabled_at,
		redirectUris: row.redirect_uris as string[],
		responseTypes: row.response_types as string[],
		scopes: row.scopes as string[],
	};
}

/** How long a person has to complete sign-in and consent before a parked request lapses. */
const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60 * 1000;

/** How long a code lives, inside the ten-minute ceiling a redirect and a token exchange never approach. */
const CODE_TTL_MS = 60 * 1000;

/** How long a redeemed code stays readable, so a second exchange is recognizable as a replay before it goes. */
const REDEEMED_CODE_RETENTION_MS = 24 * 60 * 60 * 1000;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Every `prompt` value this endpoint recognizes. */
const PROMPT_VALUES = new Set(["none", "login", "consent", "select_account"]);

/**
 * How long a step-up's own proof stands once verified, independent of the session's
 * own lifetime — the ceiling `acr_values=mfa` accepts a fresh `auth_time` against
 * before demanding the factor again.
 */
const STEP_UP_WINDOW_MS = 15 * 60 * 1000;

/** Mints an `authz_` id for a new pending interaction, unguessable since it round-trips through a browser. */
const authorizationRequestId = () => randomToken({ bytes: 32, prefix: "authz" });

/** Mints an `acode_` id for a new `authorization_codes` row. */
const authorizationCodeRowId = typeid("acode");

/** A pending interaction: the validated request, parked while a person signs in or decides on consent. */
export const authorizationRequests = table({
	name: "authorization_requests",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		client_id: c.text(),
		redirect_uri: c.text(),
		response_type: c.text(),
		scopes: c.json(),
		state: c.text().nullable(),
		nonce: c.text().nullable(),
		code_challenge: c.text(),
		code_challenge_method: c.text(),
		prompt: c.text().nullable(),
		max_age: c.integer().nullable(),
		acr_values: c.text().nullable(),
		login_hint: c.text().nullable(),
		created_at: c.integer(),
		expires_at: c.integer(),
	},
});

/** A minted authorization code: the bindings a redemption checks, and what a token is minted from. */
export const authorizationCodes = table({
	name: "authorization_codes",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		code_hash: c.text(),
		client_id: c.text(),
		redirect_uri: c.text(),
		code_challenge: c.text(),
		scopes: c.json(),
		subject_id: c.text(),
		session_id: c.text(),
		nonce: c.text().nullable(),
		auth_time: c.integer(),
		created_at: c.integer(),
		expires_at: c.integer(),
		redeemed_at: c.integer().nullable(),
		token_family_id: c.text().nullable(),
	},
});

export type AuthorizationRequestRow = TableRow<typeof authorizationRequests>;
export type AuthorizationCodeRow = TableRow<typeof authorizationCodes>;

/**
 * What `beginAuthorization` and `resumeAuthorization` both answer with. `redirect`
 * carries the complete `Location` value, success or error; `render` is for a failure
 * with nowhere verified yet to send the browser back to; `authenticate` and `consent`
 */
export type AuthorizationOutcome =
	| { kind: "redirect"; location: string }
	| { kind: "render"; error: string; description: string }
	| { kind: "authenticate"; interactionId: string; loginHint: string | null; forced: boolean }
	| { kind: "consent"; interactionId: string; screen: ConsentScreen }
	| { kind: "step-up"; interactionId: string; screen: StepUpScreen };

/** The request once every redirect-class rule has cleared it, independent of where it came from. */
export interface ValidatedRequest {
	clientId: string;
	redirectUri: string;
	responseType: string;
	scopes: string[];
	state: string | null;
	nonce: string | null;
	codeChallenge: string;
	codeChallengeMethod: string;
	promptTokens: string[];
	maxAge: number | null;
	loginHint: string | null;
	/** The `acr_values` a relying party demanded; only `mfa`, the one value discovery advertises, is recognized. */
	acrValues: string[];
}

/** Builds a URI with the given parameters set, leaving whatever else the URI already carried alone. */
function withQueryParams(uri: string, params: Record<string, string | null | undefined>): string {
	let url = new URL(uri);
	for (let [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) url.searchParams.set(key, value);
	}
	return url.toString();
}

/** The verified target every redirect-class outcome answers through, once one exists. */
export interface RedirectTarget {
	redirectUri: string;
	state: string | null;
}

/** A `render` outcome, for a failure with no verified redirect target to answer through. */
function render(error: string, description: string): AuthorizationOutcome {
	return { kind: "render", error, description };
}

/** A `redirect` outcome carrying an OAuth error onto the request's verified target. */
function redirectError(
	target: RedirectTarget,
	issuer: string,
	error: string,
	description: string,
): AuthorizationOutcome {
	return {
		kind: "redirect",
		location: withQueryParams(target.redirectUri, {
			error,
			error_description: description,
			state: target.state,
			iss: issuer,
		}),
	};
}

/**
 * A `redirect` outcome carrying a freshly minted code onto the request's verified target,
 * with the tenant's `iss` beside it (RFC 9207) so the client can tell which authorization
 * server produced the code before redeeming it.
 */
function redirectCode(target: RedirectTarget, issuer: string, code: string): AuthorizationOutcome {
	return {
		kind: "redirect",
		location: withQueryParams(target.redirectUri, { code, state: target.state, iss: issuer }),
	};
}

/** Reconstructs the validated request `resumeAuthorization` continues from a stored row. */
function requestFromRow(row: AuthorizationRequestRow): ValidatedRequest {
	return {
		clientId: row.client_id,
		redirectUri: row.redirect_uri,
		responseType: row.response_type,
		scopes: row.scopes as string[],
		state: row.state,
		nonce: row.nonce,
		codeChallenge: row.code_challenge,
		codeChallengeMethod: row.code_challenge_method,
		promptTokens: row.prompt ? row.prompt.split(" ").filter(Boolean) : [],
		maxAge: row.max_age,
		loginHint: row.login_hint,
		acrValues: row.acr_values ? row.acr_values.split(" ").filter(Boolean) : [],
	};
}

/**
 * Writes a new pending interaction for a request `beginAuthorization` is parking for the
 * first time, or answers with the interaction a `resumeAuthorization` call is already
 * continuing, which needs no second row.
 */
async function park(
	db: Database,
	request: ValidatedRequest,
	now: number,
	existingInteractionId: string | null,
): Promise<string> {
	if (existingInteractionId) return existingInteractionId;

	let id = authorizationRequestId();

	await db.create(authorizationRequests, {
		id,
		client_id: request.clientId,
		redirect_uri: request.redirectUri,
		response_type: request.responseType,
		scopes: request.scopes,
		state: request.state,
		nonce: request.nonce,
		code_challenge: request.codeChallenge,
		code_challenge_method: request.codeChallengeMethod,
		prompt: request.promptTokens.length > 0 ? request.promptTokens.join(" ") : null,
		max_age: request.maxAge,
		acr_values: request.acrValues.length > 0 ? request.acrValues.join(" ") : null,
		login_hint: request.loginHint,
		created_at: now,
		expires_at: now + AUTHORIZATION_REQUEST_TTL_MS,
	});

	return id;
}

/** Every session, among the caller's candidates, still live by both of its clocks. */
async function resolveValidSessions(
	db: Database,
	sessionIds: string[],
	now: number,
): Promise<SessionRow[]> {
	if (sessionIds.length === 0) return [];

	let rows = await db.findMany(sessions, { where: inList("id", sessionIds) });
	return rows.filter(
		(row) => row.revoked_at === null && row.expires_at > now && row.idle_expires_at > now,
	);
}

/** The one live session a resumed interaction's asserted id names, or `null` if it no longer holds. */
async function resolveResumedSession(
	db: Database,
	sessionId: string,
	now: number,
): Promise<SessionRow | null> {
	return db.findOne(sessions, {
		where: and(
			eq("id", sessionId),
			isNull("revoked_at"),
			gt("expires_at", now),
			gt("idle_expires_at", now),
		),
	});
}

/** Mints a code for a session that consent has cleared, and stores everything a redemption needs. */
async function mintCode(
	db: Database,
	input: {
		request: ValidatedRequest;
		session: SessionRow;
		grantedScopes: string[];
		now: number;
	},
): Promise<string> {
	let code = randomToken({ bytes: 32 });
	let hashed = await sha256(code);
	if (isFailure(hashed)) throw new Error("authorization code hashing failed");

	await db.create(authorizationCodes, {
		id: authorizationCodeRowId(generateUUID()).toString(),
		code_hash: Hex.encode(hashed.data),
		client_id: input.request.clientId,
		redirect_uri: input.request.redirectUri,
		code_challenge: input.request.codeChallenge,
		scopes: input.grantedScopes,
		subject_id: input.session.subject_id,
		session_id: input.session.id,
		nonce: input.request.nonce,
		auth_time: input.session.auth_time,
		created_at: input.now,
		expires_at: input.now + CODE_TTL_MS,
		redeemed_at: null,
		token_family_id: null,
	});

	return code;
}

/** What the shared decision runs once it has a request, whether fresh or resumed. */
interface DecisionContext {
	request: ValidatedRequest;
	issuer: string;
	now: number;
	/** Whether the caller just authenticated the one candidate session, past the point where `prompt=login` still applies. */
	justAuthenticated: boolean;
	candidateSessions: SessionRow[];
	existingInteractionId: string | null;
}

/**
 * The session, prompt and consent decision `beginAuthorization` and `resumeAuthorization`
 * share. A fresh call may find no session, one, or several; a resumed call is given
 * exactly one candidate — the session its caller asserts just authenticated — so the
 */
async function decide(db: Database, ctx: DecisionContext): Promise<AuthorizationOutcome> {
	let { request, issuer, now, candidateSessions, existingInteractionId, justAuthenticated } = ctx;

	let promptNone = request.promptTokens.includes("none");
	let promptLogin = request.promptTokens.includes("login");
	let promptConsent = request.promptTokens.includes("consent");
	let promptSelectAccount = request.promptTokens.includes("select_account");

	if (candidateSessions.length === 0) {
		if (promptSelectAccount) {
			return redirectError(
				request,
				issuer,
				"account_selection_required",
				"Choose an account to continue.",
			);
		}
		if (promptNone) {
			return redirectError(request, issuer, "login_required", "Sign in to continue.");
		}

		let interactionId = await park(db, request, now, existingInteractionId);
		return { kind: "authenticate", interactionId, loginHint: request.loginHint, forced: false };
	}

	if (!justAuthenticated && candidateSessions.length > 1) {
		if (promptNone) {
			return redirectError(
				request,
				issuer,
				"login_required",
				"Choose which account to continue with.",
			);
		}

		let interactionId = await park(db, request, now, existingInteractionId);
		return { kind: "authenticate", interactionId, loginHint: request.loginHint, forced: false };
	}

	let session = candidateSessions[0];
	if (!session) throw new Error("unreachable: exactly one candidate session by this point");

	if (!justAuthenticated) {
		let tooOld = request.maxAge !== null && now - session.auth_time > request.maxAge * 1000;

		if (promptLogin || promptSelectAccount || tooOld) {
			if (promptNone) {
				return redirectError(request, issuer, "login_required", "Sign in again to continue.");
			}

			let interactionId = await park(db, request, now, existingInteractionId);
			return { kind: "authenticate", interactionId, loginHint: request.loginHint, forced: true };
		}
	}

	if (request.acrValues.includes("mfa")) {
		let window =
			request.maxAge !== null
				? Math.min(STEP_UP_WINDOW_MS, request.maxAge * 1000)
				: STEP_UP_WINDOW_MS;
		let steppedUp = session.acr === "mfa" && now - session.auth_time <= window;

		if (!steppedUp) {
			if (promptNone) {
				return redirectError(
					request,
					issuer,
					"unmet_authentication_requirements",
					"A more recent proof of the second factor is required.",
				);
			}

			let interactionId = await park(db, request, now, existingInteractionId);
			let screen = await describeStepUpScreen(db, session.subject_id);
			return { kind: "step-up", interactionId, screen };
		}
	}

	let consentResult = await evaluateConsent(db, {
		subjectId: session.subject_id,
		clientId: request.clientId,
		requestedScopes: request.scopes,

		isFirstParty: false,
		promptConsent,
		silent: promptNone,
	});

	if (consentResult.decision === "skip") {
		let code = await mintCode(db, {
			request,
			session,
			grantedScopes: consentResult.grantedScopes,
			now,
		});
		return redirectCode(request, issuer, code);
	}

	if (consentResult.decision === "show") {
		let interactionId = await park(db, request, now, existingInteractionId);
		return { kind: "consent", interactionId, screen: consentResult.screen };
	}

	if (consentResult.decision === "consent-required-silent") {
		return redirectError(
			request,
			issuer,
			"consent_required",
			"This application needs your permission; sign in again to continue.",
		);
	}

	return redirectError(
		request,
		issuer,
		"server_error",
		"The account or application for this request could not be found.",
	);
}

/**
 * Why an authorization request failed validation: `target` is the verified redirect URI
 * and `state` once the client and redirect URI cleared, so the caller can answer through
 * it, and `null` before then, when the error has nowhere safe to go but the browser.
 */
export interface RequestValidationFailure {
	error: string;
	description: string;
	target: RedirectTarget | null;
}

export interface ValidateAuthorizationRequestInput {
	/** The authorization parameters, from the query, a pushed request, or a request object. */
	parameters: Record<string, string>;
	now: number;
}

/** The request once every rule cleared it, or the first rule that refused it. */
export type ValidateAuthorizationRequestResult =
	| { ok: true; request: ValidatedRequest }
	| { ok: false; failure: RequestValidationFailure };

/** A failure with no verified redirect target yet. */
function unverified(error: string, description: string): ValidateAuthorizationRequestResult {
	return { ok: false, failure: { error, description, target: null } };
}

/**
 * Runs every rule an authorization request must clear — client, redirect URI, response
 * type, scope ceiling, PKCE, `prompt` and `max_age` — in the order that decides whether a
 * failure may be redirected. `/authorize` and the PAR endpoint share it, so a pushed
 * request is held to exactly what a direct one is.
 *
 * @param db - The tenant's database.
 * @param input - The authorization parameters and the clock a client document is resolved against.
 * @returns The validated request, or the failure and whether it has a verified target.
 */
export async function validateAuthorizationRequest(
	db: Database,
	input: ValidateAuthorizationRequestInput,
): Promise<ValidateAuthorizationRequestResult> {
	let query = input.parameters;

	let clientId = query.client_id;
	if (!clientId) return unverified("invalid_request", "client_id is required.");

	let client = await resolveAuthorizingClient(db, clientId, input.now);
	if (!client) return unverified("invalid_client", "This application is not registered.");
	if (client.disabledAt !== null) {
		return unverified("invalid_client", "This application has been disabled.");
	}

	let requestedRedirectUri = query.redirect_uri;
	if (!requestedRedirectUri) return unverified("invalid_request", "redirect_uri is required.");

	let registeredUris = client.redirectUris;
	let redirectVerified = registeredUris.some((registered) =>
		redirectUriMatches(registered, requestedRedirectUri),
	);
	if (!redirectVerified) {
		return unverified("invalid_request", "redirect_uri does not match a registered value.");
	}

	let state = query.state ?? null;
	let target: RedirectTarget = { redirectUri: requestedRedirectUri, state };
	let refuse = (error: string, description: string): ValidateAuthorizationRequestResult => ({
		ok: false,
		failure: { error, description, target },
	});

	let responseType = query.response_type;

	if (responseType !== "code") {
		return refuse("unsupported_response_type", "Only the authorization code flow is supported.");
	}
	if (!client.responseTypes.includes("code")) {
		return refuse(
			"unauthorized_client",
			"This application is not authorized to use the authorization code flow.",
		);
	}

	let requestedScopes = (query.scope ?? "").split(/\s+/).filter(Boolean);
	let ceiling = client.scopes;
	if (requestedScopes.some((scope) => !ceiling.includes(scope))) {
		return refuse(
			"invalid_scope",
			"One or more requested scopes are not allowed for this application.",
		);
	}

	let codeChallenge = query.code_challenge;
	let codeChallengeMethod = query.code_challenge_method;
	if (!codeChallenge || codeChallengeMethod !== "S256") {
		return refuse("invalid_request", "A code_challenge using the S256 method is required.");
	}

	let promptTokens = query.prompt ? query.prompt.split(/\s+/).filter(Boolean) : [];
	let hasUnknownPromptValue = promptTokens.some((token) => !PROMPT_VALUES.has(token));
	if (hasUnknownPromptValue || (promptTokens.includes("none") && promptTokens.length > 1)) {
		return refuse("invalid_request", "prompt carries an invalid combination of values.");
	}

	let maxAge: number | null = null;
	if (query.max_age !== undefined) {
		if (!/^\d+$/.test(query.max_age)) {
			return refuse("invalid_request", "max_age must be a non-negative integer.");
		}
		maxAge = Number(query.max_age);
	}

	let acrValues = query.acr_values ? query.acr_values.split(/\s+/).filter(Boolean) : [];

	return {
		ok: true,
		request: {
			clientId,
			redirectUri: requestedRedirectUri,
			responseType,
			scopes: requestedScopes,
			state,
			nonce: query.nonce ?? null,
			codeChallenge,
			codeChallengeMethod,
			promptTokens,
			maxAge,
			loginHint: query.login_hint ?? null,
			acrValues,
		},
	};
}

let BeginAuthorizationSchema = s.object({
	query: s.record(s.string(), s.string()),
	sessionIds: s.array(s.string()),
	now: s.number(),
	issuer: s.string(),
	requirePushedAuthorizationRequests: s.optional(s.boolean()),
});

export interface BeginAuthorizationInput {
	query: Record<string, string>;
	sessionIds: string[];
	now: number;
	/** The tenant's own issuer, carried on every redirect back to the client as `iss`, and the audience a request object names. */
	issuer: string;
	/**
	 * Whether the tenant accepts authorization requests only through the PAR endpoint.
	 *
	 * @default false
	 */
	requirePushedAuthorizationRequests?: boolean;
}

/** The authorization parameters a request carries, or the error to render for it. */
type ResolvedParameters =
	| { ok: true; parameters: Record<string, string> }
	| { ok: false; error: string; description: string };

/**
 * Finds the parameters an `/authorize` call actually carries: a pushed request its
 * `request_uri` redeems (RFC 9126), a signed request object (RFC 9101), or the query
 * itself. With either of the first two, only `client_id` is read from the query.
 */
async function resolveParameters(
	db: Database,
	input: s.InferOutput<typeof BeginAuthorizationSchema>,
): Promise<ResolvedParameters> {
	let query = input.query;
	let clientId = query.client_id;
	if (!clientId)
		return { ok: false, error: "invalid_request", description: "client_id is required." };

	if (query.request_uri !== undefined) {
		if (query.request !== undefined) {
			return {
				ok: false,
				error: "invalid_request",
				description: "request and request_uri may not both be present.",
			};
		}

		let redeemed = await redeemPushedAuthorizationRequest(db, {
			requestUri: query.request_uri,
			clientId,
			now: input.now,
		});
		if (!redeemed.ok) {
			return {
				ok: false,
				error: "invalid_request_uri",
				description:
					"This request_uri is unknown, expired, already used, or belongs to another application.",
			};
		}
		return { ok: true, parameters: redeemed.parameters };
	}

	let pushRequired = await requiresPushedAuthorizationRequests(db, {
		clientId,
		tenantRequires: input.requirePushedAuthorizationRequests ?? false,
	});
	if (pushRequired) {
		return {
			ok: false,
			error: "invalid_request",
			description:
				"This application must push its authorization request to the PAR endpoint first.",
		};
	}

	if (query.request !== undefined) {
		let verified = await verifyRequestObject(db, {
			token: query.request,
			clientId,
			issuer: input.issuer,
			now: input.now,
		});
		if (!verified.ok) {
			return { ok: false, error: "invalid_request_object", description: verified.description };
		}
		return { ok: true, parameters: verified.parameters };
	}

	return { ok: true, parameters: query };
}

/**
 * Validates an `/authorize` request end to end and answers with one outcome: an error
 * rendered directly when there is no verified redirect target yet to answer through, an
 * error or a code redirected onto that target once there is, or a parked interaction for
 *
 * @param db - The tenant's database.
 * @param input - The request's raw query parameters, the caller's candidate session ids, the tenant's PAR policy, and the clock to validate and decide against.
 * @returns The outcome this request reaches on its own, with no round trip still owed.
 */
export async function beginAuthorization(
	db: Database,
	input: BeginAuthorizationInput,
): Promise<AuthorizationOutcome> {
	let parsed = s.parse(BeginAuthorizationSchema, input);

	let resolved = await resolveParameters(db, parsed);
	if (!resolved.ok) return render(resolved.error, resolved.description);

	let validated = await validateAuthorizationRequest(db, {
		parameters: resolved.parameters,
		now: parsed.now,
	});
	if (!validated.ok) {
		let { error, description, target } = validated.failure;
		return target
			? redirectError(target, parsed.issuer, error, description)
			: render(error, description);
	}

	let candidateSessions = await resolveValidSessions(db, parsed.sessionIds, parsed.now);

	return decide(db, {
		request: validated.request,
		issuer: parsed.issuer,
		now: parsed.now,
		justAuthenticated: false,
		candidateSessions,
		existingInteractionId: null,
	});
}

let ResumeAuthorizationSchema = s.object({
	interactionId: s.string(),
	sessionId: s.string(),
	now: s.number(),
	issuer: s.string(),
	denied: s.optional(s.boolean()),
});

export interface ResumeAuthorizationInput {
	interactionId: string;
	sessionId: string;
	now: number;
	issuer: string;
	/**
	 * Set when the person explicitly refused a shown consent screen. Answers with
	 * `access_denied` on the request's verified target directly, independent of the
	 * session or of whatever `evaluateConsent` would otherwise decide — a refusal is
	 */
	denied?: boolean;
}

/**
 * Continues a parked interaction with the session its caller asserts just authenticated,
 * running the same decision `beginAuthorization` runs from the stored request rather
 * than a fresh query.
 *
 * @param db - The tenant's database.
 * @param input - The interaction to resume, the session that authenticated it, whether the person refused a shown consent screen, and the clock to decide against.
 * @returns The outcome this resumption reaches on its own, with no round trip still owed.
 */
export async function resumeAuthorization(
	db: Database,
	input: ResumeAuthorizationInput,
): Promise<AuthorizationOutcome> {
	let parsed = s.parse(ResumeAuthorizationSchema, input);

	let stored = await db.find(authorizationRequests, { id: parsed.interactionId });
	if (!stored || stored.expires_at <= parsed.now) {
		return render(
			"invalid_request",
			"This sign-in attempt is no longer valid. Start again from the application that sent you here.",
		);
	}

	let request = requestFromRow(stored);

	if (parsed.denied) {
		return redirectError(
			request,
			parsed.issuer,
			"access_denied",
			"The person declined to grant access.",
		);
	}

	let session = await resolveResumedSession(db, parsed.sessionId, parsed.now);

	return decide(db, {
		request,
		issuer: parsed.issuer,
		now: parsed.now,
		justAuthenticated: true,
		candidateSessions: session ? [session] : [],
		existingInteractionId: parsed.interactionId,
	});
}

export interface SweepExpiredAuthorizationRequestsInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredAuthorizationRequestsResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredAuthorizationRequestsSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes pending interactions past their ten-minute window, in one bounded batch, for
 * the scheduled handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredAuthorizationRequests(
	db: Database,
	input: SweepExpiredAuthorizationRequestsInput = {},
): Promise<SweepExpiredAuthorizationRequestsResult> {
	let parsed = s.parse(SweepExpiredAuthorizationRequestsSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(authorizationRequests, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(authorizationRequests, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}

export interface SweepExpiredAuthorizationCodesInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredAuthorizationCodesResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredAuthorizationCodesSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes authorization codes in one bounded batch, for the scheduled handler driving
 * retention: an unredeemed row whose sixty seconds ran out with no exchange ever
 * landing, or a redeemed row old enough that a replay against it is no longer worth
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredAuthorizationCodes(
	db: Database,
	input: SweepExpiredAuthorizationCodesInput = {},
): Promise<SweepExpiredAuthorizationCodesResult> {
	let parsed = s.parse(SweepExpiredAuthorizationCodesSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(authorizationCodes, {
		where: or(
			and(isNull("redeemed_at"), lt("expires_at", now)),
			and(notNull("redeemed_at"), lt("redeemed_at", now - REDEEMED_CODE_RETENTION_MS)),
		),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(authorizationCodes, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
