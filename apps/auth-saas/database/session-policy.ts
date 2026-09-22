/**
 * Session policy: the five knobs a tenant's own `settings` row may customize, the
 * platform bounds and defaults each one is checked against, and the pure function that
 * resolves a tenant's stored values and its entitlement into the values `sessions.ts`,
 * `passwords.ts` and the token endpoint actually enforce. Leaf module — imports nothing
 * else under `database/`, the way `entitlements.ts` does — since nothing here needs to
 * reach another tenant table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How long a session stands before the subject must authenticate again, absent any customization. */
export const SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_LIFETIME_FLOOR_MS = 15 * 60 * 1000;
export const SESSION_ABSOLUTE_LIFETIME_CEILING_MS = 90 * 24 * 60 * 60 * 1000;

/** How long a session may sit unused before it stops standing, absent any customization. */
export const SESSION_IDLE_LIFETIME_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_LIFETIME_FLOOR_MS = 5 * 60 * 1000;

/** How long a refresh token stands before it can no longer be rotated, absent any customization. */
export const REFRESH_TOKEN_LIFETIME_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_LIFETIME_FLOOR_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_LIFETIME_CEILING_MS = 180 * 24 * 60 * 60 * 1000;

/** How many live sessions a subject may hold at once, absent any customization: unlimited. */
export const CONCURRENT_SESSION_LIMIT_DEFAULT: number | null = null;
export const CONCURRENT_SESSION_LIMIT_FLOOR = 1;
export const CONCURRENT_SESSION_LIMIT_CEILING = 100;

/** What a credential change does to a subject's other sessions, absent any customization. */
export const SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT = "revoke-others" as const;

/** What a credential change may be configured to do to a subject's other sessions. */
export type SessionsAfterCredentialChange = "revoke-others" | "revoke-all";

/**
 * The five knobs exactly as the tenant's `settings` row stores them: `null` in any
 * field means "not customized, use the platform default" — the distinction
 * {@link effectiveSessionPolicy}'s tighten-only comparison needs, since a customized
 * value that happens to equal the default is still customized for audit purposes even
 * though it resolves the same way.
 */
export interface StoredSessionPolicy {
	sessionAbsoluteLifetimeMs: number | null;
	sessionIdleLifetimeMs: number | null;
	refreshTokenLifetimeMs: number | null;
	concurrentSessionLimit: number | null;
	sessionsAfterCredentialChange: SessionsAfterCredentialChange | null;
}

/** The values `sessions.ts`, `passwords.ts` and the token endpoint actually enforce, once entitlement and tighten-only have both been applied. */
export interface EffectiveSessionPolicy {
	absoluteLifetimeMs: number;
	idleLifetimeMs: number;
	refreshTokenLifetimeMs: number;
	concurrentSessionLimit: number | null;
	sessionsAfterCredentialChange: SessionsAfterCredentialChange;
}

/** What an unprovisioned tenant, or one that has never customized a single field, enforces. */
export const DEFAULT_EFFECTIVE_SESSION_POLICY: EffectiveSessionPolicy = {
	absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
	idleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS,
	refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
	concurrentSessionLimit: CONCURRENT_SESSION_LIMIT_DEFAULT,
	sessionsAfterCredentialChange: SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT,
};

/**
 * Resolves a tenant's stored session policy into the values actually enforced. While
 * entitled, every field the tenant stored is honored exactly as stored — it was already
 * bounds-checked at write time, so nothing here re-clamps it. Once the entitlement
 * lapses, each field falls back independently to whichever of its stored value and the
 * platform default is tighter, so a downgrade never loosens a tenant's sessions past
 * what it already had stored, and never grants back more than the platform default
 * either.
 *
 * @param input - The tenant's stored policy row, and whether its plan currently
 * entitles it to customize these values at all.
 * @returns The five values `sessions.ts`, `passwords.ts` and the token endpoint
 * actually enforce.
 */
export function effectiveSessionPolicy(input: {
	stored: StoredSessionPolicy;
	hasEntitlement: boolean;
}): EffectiveSessionPolicy {
	let { stored, hasEntitlement } = input;

	let absoluteLifetimeMs: number;
	if (hasEntitlement) {
		absoluteLifetimeMs = stored.sessionAbsoluteLifetimeMs ?? SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS;
	} else {
		let storedOrDefault = stored.sessionAbsoluteLifetimeMs ?? SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS;
		absoluteLifetimeMs =
			storedOrDefault < SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS
				? storedOrDefault
				: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS;
	}

	let idleLifetimeMs: number;
	if (hasEntitlement) {
		idleLifetimeMs = stored.sessionIdleLifetimeMs ?? SESSION_IDLE_LIFETIME_DEFAULT_MS;
	} else {
		let storedOrDefault = stored.sessionIdleLifetimeMs ?? SESSION_IDLE_LIFETIME_DEFAULT_MS;
		idleLifetimeMs =
			storedOrDefault < SESSION_IDLE_LIFETIME_DEFAULT_MS
				? storedOrDefault
				: SESSION_IDLE_LIFETIME_DEFAULT_MS;
	}

	let refreshTokenLifetimeMs: number;
	if (hasEntitlement) {
		refreshTokenLifetimeMs = stored.refreshTokenLifetimeMs ?? REFRESH_TOKEN_LIFETIME_DEFAULT_MS;
	} else {
		let storedOrDefault = stored.refreshTokenLifetimeMs ?? REFRESH_TOKEN_LIFETIME_DEFAULT_MS;
		refreshTokenLifetimeMs =
			storedOrDefault < REFRESH_TOKEN_LIFETIME_DEFAULT_MS
				? storedOrDefault
				: REFRESH_TOKEN_LIFETIME_DEFAULT_MS;
	}

	// Unlimited (`null`) is the loosest value this field can hold, so any stored
	// numeric limit is automatically tighter than the unlimited default and wins
	// outright; a stored `null` falls back to the default, itself unlimited.
	let concurrentSessionLimit: number | null;
	if (hasEntitlement) {
		concurrentSessionLimit = stored.concurrentSessionLimit;
	} else if (stored.concurrentSessionLimit === null) {
		concurrentSessionLimit = CONCURRENT_SESSION_LIMIT_DEFAULT;
	} else {
		concurrentSessionLimit = stored.concurrentSessionLimit;
	}

	// `revoke-all` is the more aggressive value, so it wins the tighten-only
	// comparison outright; anything else falls back to the default, itself
	// already the least aggressive value this field can hold.
	let sessionsAfterCredentialChange: SessionsAfterCredentialChange;
	if (hasEntitlement) {
		sessionsAfterCredentialChange =
			stored.sessionsAfterCredentialChange ?? SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT;
	} else if (stored.sessionsAfterCredentialChange === "revoke-all") {
		sessionsAfterCredentialChange = "revoke-all";
	} else {
		sessionsAfterCredentialChange = SESSIONS_AFTER_CREDENTIAL_CHANGE_DEFAULT;
	}

	return {
		absoluteLifetimeMs,
		idleLifetimeMs,
		refreshTokenLifetimeMs,
		concurrentSessionLimit,
		sessionsAfterCredentialChange,
	};
}

/** A partial write to a tenant's stored session policy: a field left out leaves its column untouched. */
export interface SessionPolicyInput {
	absoluteLifetimeMs?: number;
	idleLifetimeMs?: number;
	refreshTokenLifetimeMs?: number;
	concurrentSessionLimit?: number | null;
	sessionsAfterCredentialChange?: SessionsAfterCredentialChange;
}

export type ValidateSessionPolicyResult =
	| { ok: true }
	| { ok: false; field: keyof SessionPolicyInput; message: string };

/**
 * Bounds-checks every field a `setSessionPolicy` call actually gave, refusing the first
 * one outside its range with a message naming the field, the value given, and the bound
 * it violated. A field the caller left out is never checked: leaving a column untouched
 * can never violate its own bound.
 *
 * @param input - The fields being written, and the absolute lifetime this same write
 * leaves in force — whichever the caller is also setting, or the one already stored —
 * since the idle timeout's own ceiling is that value rather than a fixed number.
 * @returns Success, or which field and bound refused the write.
 */
export function validateSessionPolicyInput(input: {
	policy: SessionPolicyInput;
	currentAbsoluteLifetimeMs: number;
}): ValidateSessionPolicyResult {
	let { policy, currentAbsoluteLifetimeMs } = input;

	if (policy.absoluteLifetimeMs !== undefined) {
		let value = policy.absoluteLifetimeMs;

		if (value < SESSION_ABSOLUTE_LIFETIME_FLOOR_MS) {
			return {
				ok: false,
				field: "absoluteLifetimeMs",
				message: `absoluteLifetimeMs of ${value}ms is below the floor of ${SESSION_ABSOLUTE_LIFETIME_FLOOR_MS}ms`,
			};
		}

		if (value > SESSION_ABSOLUTE_LIFETIME_CEILING_MS) {
			return {
				ok: false,
				field: "absoluteLifetimeMs",
				message: `absoluteLifetimeMs of ${value}ms is above the ceiling of ${SESSION_ABSOLUTE_LIFETIME_CEILING_MS}ms`,
			};
		}
	}

	if (policy.idleLifetimeMs !== undefined) {
		let value = policy.idleLifetimeMs;
		let ceiling = policy.absoluteLifetimeMs ?? currentAbsoluteLifetimeMs;

		if (value < SESSION_IDLE_LIFETIME_FLOOR_MS) {
			return {
				ok: false,
				field: "idleLifetimeMs",
				message: `idleLifetimeMs of ${value}ms is below the floor of ${SESSION_IDLE_LIFETIME_FLOOR_MS}ms`,
			};
		}

		if (value > ceiling) {
			return {
				ok: false,
				field: "idleLifetimeMs",
				message: `idleLifetimeMs of ${value}ms is above the configured absolute lifetime of ${ceiling}ms`,
			};
		}
	}

	if (policy.refreshTokenLifetimeMs !== undefined) {
		let value = policy.refreshTokenLifetimeMs;

		if (value < REFRESH_TOKEN_LIFETIME_FLOOR_MS) {
			return {
				ok: false,
				field: "refreshTokenLifetimeMs",
				message: `refreshTokenLifetimeMs of ${value}ms is below the floor of ${REFRESH_TOKEN_LIFETIME_FLOOR_MS}ms`,
			};
		}

		if (value > REFRESH_TOKEN_LIFETIME_CEILING_MS) {
			return {
				ok: false,
				field: "refreshTokenLifetimeMs",
				message: `refreshTokenLifetimeMs of ${value}ms is above the ceiling of ${REFRESH_TOKEN_LIFETIME_CEILING_MS}ms`,
			};
		}
	}

	if (policy.concurrentSessionLimit !== undefined && policy.concurrentSessionLimit !== null) {
		let value = policy.concurrentSessionLimit;

		if (value < CONCURRENT_SESSION_LIMIT_FLOOR || value > CONCURRENT_SESSION_LIMIT_CEILING) {
			return {
				ok: false,
				field: "concurrentSessionLimit",
				message: `concurrentSessionLimit of ${value} is outside the range of ${CONCURRENT_SESSION_LIMIT_FLOOR}-${CONCURRENT_SESSION_LIMIT_CEILING}, or unlimited`,
			};
		}
	}

	return { ok: true };
}
