/**
 * GitHub sign-in: starting the redirect, finishing the callback, and turning the
 * identity it returns into one of this server's subjects — provisioning the subject,
 * its connection and its billing customer on a first sign-in.
 *
 * The database has no transactions, so provisioning writes sequentially and undoes
 * what it created when a later step fails; a half-provisioned person would be able to
 * sign in with no way to bill them, or be locked out by a row they cannot see.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";
import type { Result } from "@pkg/result";
import type { GitHubAuthProfile } from "remix/auth";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { failure, success } from "@pkg/result";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { createGitHubAuthProvider, finishExternalAuth, startExternalAuth } from "remix/auth";

import Connection from "~/app/data/connection";
import Subject from "~/app/data/subject";
import Customer from "~/app/services/customer";
import routes from "~/routes/web";

/** Value stored in `connections.provider` for a GitHub identity. */
const PROVIDER = "github";

/**
 * Reason reported when provisioning was rolled back. Deliberately says nothing about
 * which step failed: the relying party can only retry either way.
 */
const PROVISIONING_FAILED = "Could not complete the sign-up. Please try again.";

/**
 * A GitHub profile as this server reads it.
 *
 * `node_id` is not part of the provider's declared profile type, but it is present in
 * GitHub's response and it is the identifier already recorded for every connection in
 * this database, so it is read here rather than being lost to the narrower type.
 */
type GitHubProfile = GitHubAuthProfile & { node_id?: unknown };

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
 * Builds the GitHub provider for the request's own origin.
 *
 * Created per request rather than once at module scope because the callback URL has to
 * match the origin the person is actually on — the development host, the deployment's
 * own hostname, or the production domain — and GitHub compares it exactly.
 */
function createProvider(origin: string) {
	return createGitHubAuthProvider({
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET,
		redirectUri: new URL(routes.auth.providerCallback.href({ provider: PROVIDER }), origin),
	});
}

/**
 * Starts the GitHub flow: stores the OAuth transaction in this server's own session
 * and answers with the redirect to GitHub.
 *
 * The default scopes are exactly what this server needs — the profile and the account's
 * email addresses — so none are requested explicitly.
 */
export async function startGitHubLogin(ctx: RequestContext): Promise<Response> {
	return await startExternalAuth(createProvider(ctx.url.origin), ctx);
}

/**
 * Completes the GitHub callback and returns the profile it authenticated.
 *
 * A callback carrying the provider's own `error` is reported as `access_denied`, which
 * is what a person declining the authorization looks like; anything else becomes
 * `server_error` with a fixed description, so nothing about the failure leaks to the
 * relying party.
 */
export async function finishGitHubLogin(
	ctx: RequestContext,
): Promise<Result<GitHubProfile, ProviderLoginError>> {
	let providerError = ctx.url.searchParams.get("error");

	if (providerError) {
		let description = ctx.url.searchParams.get("error_description") ?? providerError;
		return failure(new ProviderLoginError("access_denied", description));
	}

	try {
		let { result } = await finishExternalAuth(createProvider(ctx.url.origin), ctx);
		return success(result.profile as GitHubProfile);
	} catch {
		return failure(new ProviderLoginError("server_error", "GitHub sign-in could not be completed"));
	}
}

/**
 * The identifier a GitHub identity is recorded under.
 *
 * GitHub's `node_id` is what every existing connection in this database holds, so it
 * stays the identifier of record; the numeric id is used only when a response somehow
 * omits it, so an identity is never left unrecordable.
 */
function externalIdOf(profile: GitHubProfile): string {
	return typeof profile.node_id === "string" ? profile.node_id : String(profile.id);
}

/**
 * Resolves a GitHub profile to the subject it signs in as, provisioning one on a first
 * sign-in.
 *
 * A returning identity is matched on its recorded identifier — the node id first, then
 * the numeric id, so a connection written under either is found. A first sign-in whose
 * email already belongs to a subject is refused rather than linked: the email is the
 * only thing tying them together, and silently adopting an existing account on that
 * basis is an account takeover if the address was never proven.
 *
 * @param db - Database the subject and connection are written to.
 * @param polar - Billing client the subject is mirrored into.
 * @param profile - The profile GitHub authenticated.
 * @returns The subject id to issue an authorization code for.
 */
export async function resolveGitHubSubject(
	db: Database,
	polar: PolarClient,
	profile: GitHubProfile,
): Promise<Result<string, ProviderLoginError>> {
	let logger = getContext().logger;
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
		// GitHub only hands out an address it has verified for the account, so the
		// subject starts verified and never has to prove it again here.
		email_verified_at: Date.now(),
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
		// Undone in reverse order, so the subject — the row everything else points at —
		// is the last thing to go and never outlives what depends on it.
		let created = await Connection.find(db, PROVIDER, externalId);
		if (created) await Connection.delete(db, created.id);
		await Subject.delete(db, subject.id);
		logger.error("github_customer_create_failed", { subjectId: subject.id });
		return failure(new ProviderLoginError("server_error", PROVISIONING_FAILED));
	}

	logger.info("github_subject_created", { subjectId: subject.id });

	return success(subject.id);
}
