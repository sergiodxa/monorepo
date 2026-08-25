/**
 * GitHub sign-in: starts the redirect, completes the callback, and resolves the
 * identity to a subject, provisioning its connection and billing customer on first sign-in.
 *
 * The database has no transactions, so provisioning writes sequentially and
 * rolls back the subject when its connection cannot be written — an unconnected
 * subject is unreachable and would block the next attempt on the same address.
 *
 * A failed billing mirror is only logged: nothing is charged at sign-up, so the
 * sign-in it already granted stands regardless.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";
import type { Result } from "@pkg/result";
import type { GitHubAuthProfile } from "remix/auth";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { failure, isFailure, success } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { createGitHubAuthProvider, finishExternalAuth, startExternalAuth } from "remix/auth";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";

import Connection from "~/app/data/connection";
import Subject from "~/app/data/subject";
import Customer from "~/app/services/customer";
import routes from "~/routes/web";

/** Value stored in `connections.provider` for a GitHub identity. */
const PROVIDER = "github";

/** GitHub's address list, the only place the per-address verification flag is published. */
const GITHUB_USER_EMAILS_ENDPOINT = "https://api.github.com/user/emails";

/**
 * The address list as this server reads it: the address and whether GitHub has
 * verified it, with every other field dropped. Wrapped in an object because the
 * validator takes a keyed input; the wrapper stays module-local.
 */
const GITHUB_EMAILS_SCHEMA = s.object({
	emails: s.array(s.object({ email: s.string(), verified: s.boolean() })),
});

/**
 * Reason reported when provisioning was rolled back — the same text regardless
 * of which write failed, since the relying party can only retry either way.
 */
const PROVISIONING_FAILED = "Could not complete the sign-up. Please try again.";

/**
 * A GitHub profile as this server reads it. `node_id` is not part of the
 * provider's declared profile type, but it is present in GitHub's response and
 * is the identifier already recorded for every connection, so it is kept here.
 */
type GitHubProfile = GitHubAuthProfile & { node_id?: unknown };

/**
 * A completed GitHub sign-in: the profile, and whether GitHub reports the
 * profile's own address as verified. Carried separately because the profile
 * itself has no such field, so the flag is never assumed from GitHub's behavior.
 */
export interface GitHubIdentity {
	/** The profile GitHub authenticated. */
	profile: GitHubProfile;
	/**
	 * Whether GitHub reports {@link GitHubIdentity.profile}'s own address as
	 * verified. `false` whenever that cannot be established, so an unproven
	 * address is never recorded as proven because a request failed.
	 */
	emailVerified: boolean;
}

/**
 * Why a GitHub sign-in could not be completed, in the shape an authorization error
 * response carries so the relying party is told something it can act on.
 */
export class ProviderLoginError extends Error {
	/** OAuth error code sent back to the relying party. */
	readonly code: string;
	/** Human-readable reason sent alongside {@link ProviderLoginError.code}. */
	readonly description: string;

	/**
	 * @param code - OAuth error code, such as `access_denied` or `server_error`.
	 * @param description - Reason safe to show a person; never carries provider internals.
	 */
	constructor(code: string, description: string) {
		super(description);
		this.name = "ProviderLoginError";
		this.code = code;
		this.description = description;
	}
}

/**
 * Builds the GitHub provider for the request's own origin. Created fresh per
 * request because the callback URL must match wherever the person actually
 * is — dev host, deployment hostname, or production — and GitHub compares it exactly.
 */
function createProvider(origin: string) {
	return createGitHubAuthProvider({
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET,
		redirectUri: new URL(routes.auth.providerCallback.href({ provider: PROVIDER }), origin),
	});
}

/**
 * Starts the GitHub flow: stores the OAuth transaction in this server's own
 * session and answers with the redirect to GitHub. The default scopes already
 * cover what this server needs, so none are requested explicitly.
 */
export async function startGitHubLogin(ctx: RequestContext): Promise<Response> {
	return await startExternalAuth(createProvider(ctx.url.origin), ctx);
}

/**
 * Asks GitHub whether it has verified one address on the account that just
 * authorized this server; the profile carries no such flag. Fails closed on
 * any refused or unreadable response, logging only the status since the body can quote the address.
 *
 * @param accessToken - The provider token the callback exchanged; never logged.
 * @param email - The address to look up, as the profile reported it.
 */
async function isGitHubEmailVerified(accessToken: string, email: string | null): Promise<boolean> {
	if (!email) return false;

	let logger = getContext().logger;

	try {
		let response = await fetch(GITHUB_USER_EMAILS_ENDPOINT, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "auth.sergiodxa.com",
			},
		});

		if (!response.ok) {
			logger.info("github_emails_unreadable", { status: response.status });
			return false;
		}

		let parsed = await validate({ emails: await response.json() }, GITHUB_EMAILS_SCHEMA);
		if (isFailure(parsed)) {
			logger.info("github_emails_unreadable", { status: response.status });
			return false;
		}

		let wanted = email.toLowerCase();

		return parsed.data.emails.some(
			(entry) => entry.verified && entry.email.toLowerCase() === wanted,
		);
	} catch {
		logger.info("github_emails_request_failed");
		return false;
	}
}

/**
 * Completes the GitHub callback and returns the identity it authenticated,
 * together with GitHub's own verdict on the address. A provider `error` maps
 * to `access_denied`; anything else becomes a fixed `server_error`, so nothing leaks to the relying party.
 */
export async function finishGitHubLogin(
	ctx: RequestContext,
): Promise<Result<GitHubIdentity, ProviderLoginError>> {
	let providerError = ctx.url.searchParams.get("error");

	if (providerError) {
		let description = ctx.url.searchParams.get("error_description") ?? providerError;
		return failure(new ProviderLoginError("access_denied", description));
	}

	try {
		let { result } = await finishExternalAuth(createProvider(ctx.url.origin), ctx);
		let profile = result.profile as GitHubProfile;

		return success({
			profile,
			emailVerified: await isGitHubEmailVerified(result.tokens.accessToken, profile.email ?? null),
		});
	} catch {
		return failure(new ProviderLoginError("server_error", "GitHub sign-in could not be completed"));
	}
}

/**
 * The identifier a GitHub identity is recorded under: `node_id`, matching
 * every existing connection in this database. Falls back to the numeric id
 * only when a response omits it, so an identity is never left unrecordable.
 */
function externalIdOf(profile: GitHubProfile): string {
	return typeof profile.node_id === "string" ? profile.node_id : String(profile.id);
}

/**
 * Resolves a GitHub profile to the subject it signs in as, provisioning one on
 * a first sign-in. An email already tied to a subject stops the sign-in,
 * since address alone proves no ownership and adopting the account on it would be a takeover.
 *
 * @param db - Database the subject and connection are written to.
 * @param polar - Billing client the subject is mirrored into, best effort; a
 * failed mirror is only logged, since a later lookup by address recovers it.
 * @param identity - The profile GitHub authenticated and its verification verdict.
 * @returns The subject id to issue an authorization code for.
 */
export async function resolveGitHubSubject(
	db: Database,
	polar: PolarClient,
	identity: GitHubIdentity,
): Promise<Result<string, ProviderLoginError>> {
	let logger = getContext().logger;
	let { profile, emailVerified } = identity;
	let externalId = externalIdOf(profile);

	let connection =
		(await Connection.find(db, PROVIDER, externalId)) ??
		(await Connection.find(db, PROVIDER, String(profile.id)));

	if (connection) {
		logger.info("github_connection_found", { subjectId: connection.subject_id });
		return success(connection.subject_id);
	}

	let email = profile.email;
	if (!email) {
		logger.info("github_email_missing");
		return failure(
			new ProviderLoginError("access_denied", "GitHub did not provide an email address"),
		);
	}

	if (await Subject.findByEmail(db, email)) {
		logger.info("github_email_already_registered");
		return failure(
			new ProviderLoginError(
				"access_denied",
				"An account already exists for this email address. Sign in with your password instead.",
			),
		);
	}

	let subject = await Subject.create(db, {
		email_address: email,
		display_name: profile.name ?? profile.login,
		username: profile.login,
		avatar: profile.avatar_url ?? "",
		email_verified_at: emailVerified ? Date.now() : null,
	});

	try {
		await Connection.create(db, PROVIDER, externalId, subject.id);
	} catch {
		await Subject.delete(db, subject.id);
		logger.error("github_connection_create_failed", { subjectId: subject.id });
		return failure(new ProviderLoginError("server_error", PROVISIONING_FAILED));
	}

	try {
		await Customer.findOrCreateByEmail(polar, email, subject);
	} catch {
		logger.error("github_customer_create_failed", { subjectId: subject.id });
	}

	logger.info("github_subject_created", { subjectId: subject.id, emailVerified });

	return success(subject.id);
}
