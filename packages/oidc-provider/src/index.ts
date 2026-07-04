import type { DatabaseAdapter } from "remix/data-table";

import { Logger } from "@pkg/logger/request";
import { createDatabase } from "remix/data-table";

import { runMigrations } from "./database/migrations";
import AuthorizationCode from "./oauth/models/authorization-code";
import Session from "./oauth/models/session";
import { createProviderRouter } from "./provider";
import SigningKey from "./signing-keys/models/signing-key";
import EmailVerificationToken from "./subjects/models/email-verification-token";
import Subject from "./subjects/models/subject";
import WebAuthnChallenge from "./webauthn/models/webauthn-challenge";

/** Sink for authentication/registration analytics events (host-provided). */
export interface AnalyticsSink {
	/** Records that a subject authenticated. */
	trackAuthentication(tenantId: string, subjectId: string): void;
	/** Records that a subject registered. */
	trackRegistration(tenantId: string, subjectId: string): void;
}

/** Configuration for {@link createOidcProvider}. */
export interface OidcProviderConfig {
	/** SQL access. DO host: @pkg/data-table-sqlstorage. Self-hosted: @pkg/data-table-d1. */
	database: DatabaseAdapter;
	/** HMAC secret shared with the control plane for Management API internal tokens. */
	internalSecret: string;
	/** Optional analytics sink; a no-op sink is used when omitted (self-hosted default). */
	analytics?: AnalyticsSink;
	/** "auto" (default): migrate lazily before the first request. "manual": host calls migrate(). */
	migrations?: "auto" | "manual";
}

/** A host-agnostic OIDC provider instance. */
export interface OidcProvider {
	/** Handles one request. Pure Fetch: Workers, Durable Objects, Bun, Node. */
	fetch(request: Request): Promise<Response>;
	/** Applies pending engine-owned migrations. Idempotent (journaled). */
	migrate(): Promise<{ applied: string[] }>;
	/** Generates the initial ES256 signing key if none exists. Idempotent. */
	ensureSigningKeys(): Promise<void>;
	/** Deletes expired sessions/codes/challenges/tokens and unverified subjects. */
	cleanup(): Promise<void>;
}

/** Analytics sink that discards events, used when the host provides none. */
const NOOP_ANALYTICS: AnalyticsSink = {
	trackAuthentication() {},
	trackRegistration() {},
};

/**
 * Creates an OIDC/OAuth2 provider bound to injected storage and secrets.
 *
 * The same provider runs inside a Cloudflare Durable Object (the multi-tenant
 * platform) or on a plain Worker with D1 (self-hosted); the host only differs in
 * the {@link OidcProviderConfig.database} adapter it injects. Everything else the
 * provider needs at request time (issuer, signing keys, clients) lives in its own
 * database.
 * @param config - Injected storage, internal secret, and optional analytics.
 * @returns A provider exposing `fetch` and `migrate`.
 */
export function createOidcProvider(config: OidcProviderConfig): OidcProvider {
	let db = createDatabase(config.database);
	let analytics = config.analytics ?? NOOP_ANALYTICS;
	let options = { internalSecret: config.internalSecret, analytics };

	let migrated: Promise<{ applied: string[] }> | null = null;
	function migrate() {
		return runMigrations(config.database);
	}

	async function ensureSigningKeys() {
		let current = await SigningKey.getCurrent(db);
		if (!current) await SigningKey.generate(db);
	}

	async function cleanup() {
		let now = Date.now();
		let oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
		await Promise.all([
			Subject.cleanupUnverified(db, oneWeekAgo),
			Session.cleanupExpired(db, now),
			AuthorizationCode.cleanupExpired(db, now),
			WebAuthnChallenge.cleanupExpired(db, now),
			EmailVerificationToken.cleanupExpired(db, now),
		]);
	}

	return {
		migrate,
		ensureSigningKeys,
		cleanup,
		async fetch(request) {
			if (config.migrations !== "manual") await (migrated ??= migrate());

			let logger = new Logger(request);
			try {
				let response = await createProviderRouter(db, logger, options).fetch(request);
				logger.response = response;
				return response;
			} finally {
				logger.flush();
			}
		},
	};
}

// The platform<->tenant internal-token contract ships from here so the control
// plane and the provider always agree on algorithm and claims.
export { createInternalToken, verifyInternalToken } from "./shared/lib/internal-auth";
