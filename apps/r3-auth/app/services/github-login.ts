/**
 * GitHub sign-in: starting the redirect, finishing the callback, and turning the
 * identity it returns into one of this server's subjects — provisioning the subject,
 * its connection and its billing customer on a first sign-in.
 *
 * The provider's address list is read here as well, because the per-address `verified`
 * flag is published only there and nowhere on a profile, and `subjects.email_verified_at`
 * is served to relying parties as `email_verified`. Assuming it would record a
 * verification this server never observed.
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

import { failure, isFailure, success } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { createGitHubAuthProvider, finishExternalAuth, startExternalAuth } from "remix/auth";
import * as s from "remix/data-schema";

import Connection from "~/app/data/connection";
import Subject from "~/app/data/subject";
import Customer from "~/app/services/customer";
import routes from "~/routes/web";

/** Value stored in `connections.provider` for a GitHub identity. */
const PROVIDER = "github";

/** GitHub's address list, the only place the per-address verification flag is published. */
const GITHUB_USER_EMAILS_ENDPOINT = "https://api.github.com/user/emails";

/**
 * The address list as this server reads it: the address and whether GitHub has verified it,
 * with every other field the endpoint returns dropped.
 *
 * Wrapped in an object because the validator takes a keyed input, and the list itself is a
 * bare JSON array; the wrapper never leaves this module.
 */
const GITHUB_EMAILS_SCHEMA = s.object({
	emails: s.array(s.object({ email: s.string(), verified: s.boolean() })),
});

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
 * A completed GitHub sign-in: the profile, and whether GitHub itself reports the address
 * on it as verified.
 *
 * The flag is carried separately because the profile has no field for it — the address
 * list is a second request, and the provider that fetches it keeps only the address it
 * chose. Without this, "verified" could only ever be an assumption about GitHub's
 * behaviour, and this server would record a verification it never observed.
 */
export interface GitHubIdentity {
	/** The profile GitHub authenticated. */
	profile: GitHubProfile;
	/**
	 * Whether GitHub reports {@link GitHubIdentity.profile}'s own address as verified.
	 *
	 * `false` whenever that cannot be established — no address, an unreadable list, a
	 * list the address is absent from — so an unproven address is never recorded as
	 * proven because a request failed.
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
 * Asks GitHub whether it has verified one specific address on the account that just
 * authorized this server.
 *
 * The address list is read here rather than trusted from the profile because the profile
 * carries no verification flag at all: the `verified` boolean lives only on this
 * endpoint's entries, and it is dropped before a profile is assembled. `user:email` is
 * among the scopes the flow requests, so the token this runs with can read it.
 *
 * Fails closed in every direction — a refused or unreadable response, and an address the
 * list does not contain, all report `false`. The comparison is case-insensitive because
 * the mailbox part is the only case-sensitive piece of an address in theory and never in
 * practice, and treating `A@x` and `a@x` as different addresses here would report a
 * verified address as unverified.
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
			// The status only; the body can quote the address the request was about.
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
 * Completes the GitHub callback and returns the identity it authenticated, together with
 * GitHub's own verdict on the address.
 *
 * A callback carrying the provider's own `error` is reported as `access_denied`, which
 * is what a person declining the authorization looks like; anything else becomes
 * `server_error` with a fixed description, so nothing about the failure leaks to the
 * relying party.
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
 * A subject provisioned here starts verified only when GitHub said the address is
 * verified. When it did not, `email_verified_at` stays null, which is what makes
 * `email_verified` in UserInfo the truth rather than an assumption, and what puts the
 * account into the flow that asks the person to prove the address.
 *
 * @param db - Database the subject and connection are written to.
 * @param polar - Billing client the subject is mirrored into.
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
		// Stamped only when GitHub's address list actually said `verified`. Anything else —
		// an unverified entry, an unreadable list, an address the list does not hold —
		// leaves this null, because a verification nobody observed is worse than none: it
		// is published to every relying party as `email_verified: true`.
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
		// Undone in reverse order, so the subject — the row everything else points at —
		// is the last thing to go and never outlives what depends on it.
		let created = await Connection.find(db, PROVIDER, externalId);
		if (created) await Connection.delete(db, created.id);
		await Subject.delete(db, subject.id);
		logger.error("github_customer_create_failed", { subjectId: subject.id });
		return failure(new ProviderLoginError("server_error", PROVISIONING_FAILED));
	}

	logger.info("github_subject_created", { subjectId: subject.id, emailVerified });

	return success(subject.id);
}
