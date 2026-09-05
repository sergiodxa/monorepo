/**
 * Public entry point of the host-agnostic OIDC/OAuth2 provider engine.
 *
 * Exposes {@link createOidcProvider}, its config/instance types, and the internal
 * platform<->tenant token helpers. The same engine runs on Cloudflare Durable
 * Objects or a plain Worker; hosts differ only in the database adapter they inject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DatabaseDriver } from "remix/data-table";

import { Database } from "remix/data-table";

import { runMigrations } from "./database/migrations.js";
import AuthorizationCode from "./oauth/models/authorization-code.js";
import Session from "./oauth/models/session.js";
import { createProviderRouter } from "./provider.js";
import SigningKey from "./signing-keys/models/signing-key.js";
import EmailVerificationToken from "./subjects/models/email-verification-token.js";
import Subject from "./subjects/models/subject.js";
import WebAuthnChallenge from "./webauthn/models/webauthn-challenge.js";

/** Sink for authentication/registration analytics events (host-provided). */
export interface AnalyticsSink {
	trackAuthentication(tenantId: string, subjectId: string): void;
	trackRegistration(tenantId: string, subjectId: string): void;
}

/** Configuration for {@link createOidcProvider}. */
export interface OidcProviderConfig {
	/** SQL access. DO host: @sdxc/data-table-sqlstorage. Self-hosted: @sdxc/data-table-d1. */
	database: DatabaseDriver;
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
 * Creates an OIDC/OAuth2 provider bound to injected storage and secrets. The
 * same engine runs on a Cloudflare Durable Object or a plain Worker with D1;
 * only the {@link OidcProviderConfig.database} adapter differs by host.
 * @param config - Injected storage, internal secret, and optional analytics.
 * @returns A provider exposing `fetch` and `migrate`.
 */
export function createOidcProvider(config: OidcProviderConfig): OidcProvider {
	let db = new Database(config.database);
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
			return createProviderRouter(db, options).fetch(request);
		},
	};
}

/**
 * The platform<->tenant internal-token contract ships from here so the
 * control plane and the provider always agree on algorithm and claims.
 */
export { createInternalToken, verifyInternalToken } from "./shared/lib/internal-auth.js";
