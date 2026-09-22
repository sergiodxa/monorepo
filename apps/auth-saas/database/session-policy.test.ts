/**
 * Exercises `session-policy.ts`'s two pure functions directly: no database, no
 * Durable Object, just the tighten-only comparison and the bounds check every write
 * runs through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	CONCURRENT_SESSION_LIMIT_CEILING,
	CONCURRENT_SESSION_LIMIT_FLOOR,
	effectiveSessionPolicy,
	REFRESH_TOKEN_LIFETIME_CEILING_MS,
	REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
	REFRESH_TOKEN_LIFETIME_FLOOR_MS,
	SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
	SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
	SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
	SESSION_IDLE_LIFETIME_DEFAULT_MS,
	SESSION_IDLE_LIFETIME_FLOOR_MS,
	type StoredSessionPolicy,
	validateSessionPolicyInput,
} from "./session-policy";

/** A stored row with every field left uncustomized, the shape most tests start from and override. */
let unstored: StoredSessionPolicy = {
	sessionAbsoluteLifetimeMs: null,
	sessionIdleLifetimeMs: null,
	refreshTokenLifetimeMs: null,
	concurrentSessionLimit: null,
	sessionsAfterCredentialChange: null,
};

describe("effectiveSessionPolicy", () => {
	test("an unprovisioned or never-customized tenant enforces every platform default", () => {
		let effective = effectiveSessionPolicy({ stored: unstored, hasEntitlement: false });

		expect(effective).toEqual({
			absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			idleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS,
			refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
			concurrentSessionLimit: null,
			sessionsAfterCredentialChange: "revoke-others",
		});
	});

	describe("entitled", () => {
		test("honors every stored value exactly, including one looser than the default", () => {
			let stored: StoredSessionPolicy = {
				sessionAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 1000,
				sessionIdleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS + 1000,
				refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_DEFAULT_MS + 1000,
				concurrentSessionLimit: 25,
				sessionsAfterCredentialChange: "revoke-all",
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: true });

			expect(effective).toEqual({
				absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS + 1000,
				idleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS + 1000,
				refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_DEFAULT_MS + 1000,
				concurrentSessionLimit: 25,
				sessionsAfterCredentialChange: "revoke-all",
			});
		});

		test("honors a stored value shorter than the default too", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: true });

			expect(effective.absoluteLifetimeMs).toBe(SESSION_ABSOLUTE_LIFETIME_FLOOR_MS);
		});

		test("falls back to the default for any field left uncustomized", () => {
			let effective = effectiveSessionPolicy({ stored: unstored, hasEntitlement: true });

			expect(effective).toEqual({
				absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				idleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS,
				refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_DEFAULT_MS,
				concurrentSessionLimit: null,
				sessionsAfterCredentialChange: "revoke-others",
			});
		});
	});

	describe("not entitled", () => {
		test("absoluteLifetimeMs: keeps a stored value tighter than the default", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.absoluteLifetimeMs).toBe(SESSION_ABSOLUTE_LIFETIME_FLOOR_MS);
		});

		test("absoluteLifetimeMs: falls back to the default for a stored value looser than it", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_CEILING_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.absoluteLifetimeMs).toBe(SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS);
		});

		test("idleLifetimeMs: keeps a stored value tighter than the default", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionIdleLifetimeMs: SESSION_IDLE_LIFETIME_FLOOR_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.idleLifetimeMs).toBe(SESSION_IDLE_LIFETIME_FLOOR_MS);
		});

		test("idleLifetimeMs: falls back to the default for a stored value looser than it", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionIdleLifetimeMs: SESSION_IDLE_LIFETIME_DEFAULT_MS + 1000,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.idleLifetimeMs).toBe(SESSION_IDLE_LIFETIME_DEFAULT_MS);
		});

		test("refreshTokenLifetimeMs: keeps a stored value tighter than the default", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_FLOOR_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.refreshTokenLifetimeMs).toBe(REFRESH_TOKEN_LIFETIME_FLOOR_MS);
		});

		test("refreshTokenLifetimeMs: falls back to the default for a stored value looser than it", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_CEILING_MS,
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.refreshTokenLifetimeMs).toBe(REFRESH_TOKEN_LIFETIME_DEFAULT_MS);
		});

		test("concurrentSessionLimit: a stored number always beats the unlimited default, since unlimited is the loosest value", () => {
			let stored: StoredSessionPolicy = { ...unstored, concurrentSessionLimit: 5 };

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.concurrentSessionLimit).toBe(5);
		});

		test("concurrentSessionLimit: a stored unlimited value falls back to the (also unlimited) default", () => {
			let stored: StoredSessionPolicy = { ...unstored, concurrentSessionLimit: null };

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.concurrentSessionLimit).toBeNull();
		});

		test("sessionsAfterCredentialChange: a stored revoke-all beats the default, since it is the tighter value", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionsAfterCredentialChange: "revoke-all",
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.sessionsAfterCredentialChange).toBe("revoke-all");
		});

		test("sessionsAfterCredentialChange: a stored revoke-others falls back to the (identical) default", () => {
			let stored: StoredSessionPolicy = {
				...unstored,
				sessionsAfterCredentialChange: "revoke-others",
			};

			let effective = effectiveSessionPolicy({ stored, hasEntitlement: false });

			expect(effective.sessionsAfterCredentialChange).toBe("revoke-others");
		});
	});
});

describe("validateSessionPolicyInput", () => {
	test("accepts an empty partial input outright", () => {
		expect(
			validateSessionPolicyInput({
				policy: {},
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			}),
		).toEqual({ ok: true });
	});

	describe("absoluteLifetimeMs", () => {
		test("refuses below the floor, naming the field, value and bound", () => {
			let result = validateSessionPolicyInput({
				policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS - 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "absoluteLifetimeMs" });
			if (result.ok) throw new Error("unreachable");
			expect(result.message).toContain(String(SESSION_ABSOLUTE_LIFETIME_FLOOR_MS - 1));
			expect(result.message).toContain(String(SESSION_ABSOLUTE_LIFETIME_FLOOR_MS));
		});

		test("refuses above the ceiling", () => {
			let result = validateSessionPolicyInput({
				policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_CEILING_MS + 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "absoluteLifetimeMs" });
		});

		test("accepts exactly the floor and exactly the ceiling", () => {
			expect(
				validateSessionPolicyInput({
					policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_FLOOR_MS },
					currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				}),
			).toEqual({ ok: true });

			expect(
				validateSessionPolicyInput({
					policy: { absoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_CEILING_MS },
					currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				}),
			).toEqual({ ok: true });
		});
	});

	describe("idleLifetimeMs", () => {
		test("refuses below the floor", () => {
			let result = validateSessionPolicyInput({
				policy: { idleLifetimeMs: SESSION_IDLE_LIFETIME_FLOOR_MS - 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "idleLifetimeMs" });
		});

		test("refuses above the absolute lifetime this same write leaves in force", () => {
			let result = validateSessionPolicyInput({
				policy: { idleLifetimeMs: 10 * 24 * 60 * 60 * 1000 },
				currentAbsoluteLifetimeMs: 5 * 24 * 60 * 60 * 1000,
			});

			expect(result).toMatchObject({ ok: false, field: "idleLifetimeMs" });
			if (result.ok) throw new Error("unreachable");
			expect(result.message).toContain(String(5 * 24 * 60 * 60 * 1000));
		});

		test("checks against the absolute lifetime this same call is also setting, not the one already stored", () => {
			// Stored absolute lifetime is short, but this call raises it in the same
			// write — the idle ceiling has to be the value this write leaves in
			// force, not the one it is replacing.
			let result = validateSessionPolicyInput({
				policy: {
					absoluteLifetimeMs: 30 * 24 * 60 * 60 * 1000,
					idleLifetimeMs: 10 * 24 * 60 * 60 * 1000,
				},
				currentAbsoluteLifetimeMs: 5 * 24 * 60 * 60 * 1000,
			});

			expect(result).toEqual({ ok: true });
		});

		test("accepts an idle timeout equal to the configured absolute lifetime", () => {
			let result = validateSessionPolicyInput({
				policy: { idleLifetimeMs: 5 * 24 * 60 * 60 * 1000 },
				currentAbsoluteLifetimeMs: 5 * 24 * 60 * 60 * 1000,
			});

			expect(result).toEqual({ ok: true });
		});
	});

	describe("refreshTokenLifetimeMs", () => {
		test("refuses below the floor", () => {
			let result = validateSessionPolicyInput({
				policy: { refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_FLOOR_MS - 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "refreshTokenLifetimeMs" });
		});

		test("refuses above the ceiling", () => {
			let result = validateSessionPolicyInput({
				policy: { refreshTokenLifetimeMs: REFRESH_TOKEN_LIFETIME_CEILING_MS + 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "refreshTokenLifetimeMs" });
		});
	});

	describe("concurrentSessionLimit", () => {
		test("refuses a limit below the floor", () => {
			let result = validateSessionPolicyInput({
				policy: { concurrentSessionLimit: CONCURRENT_SESSION_LIMIT_FLOOR - 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "concurrentSessionLimit" });
		});

		test("refuses a limit above the ceiling", () => {
			let result = validateSessionPolicyInput({
				policy: { concurrentSessionLimit: CONCURRENT_SESSION_LIMIT_CEILING + 1 },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toMatchObject({ ok: false, field: "concurrentSessionLimit" });
		});

		test("accepts null, for unlimited", () => {
			let result = validateSessionPolicyInput({
				policy: { concurrentSessionLimit: null },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			});

			expect(result).toEqual({ ok: true });
		});

		test("accepts exactly the floor and exactly the ceiling", () => {
			expect(
				validateSessionPolicyInput({
					policy: { concurrentSessionLimit: CONCURRENT_SESSION_LIMIT_FLOOR },
					currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				}),
			).toEqual({ ok: true });

			expect(
				validateSessionPolicyInput({
					policy: { concurrentSessionLimit: CONCURRENT_SESSION_LIMIT_CEILING },
					currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
				}),
			).toEqual({ ok: true });
		});
	});

	test("sessionsAfterCredentialChange: accepts both values", () => {
		expect(
			validateSessionPolicyInput({
				policy: { sessionsAfterCredentialChange: "revoke-others" },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			}),
		).toEqual({ ok: true });

		expect(
			validateSessionPolicyInput({
				policy: { sessionsAfterCredentialChange: "revoke-all" },
				currentAbsoluteLifetimeMs: SESSION_ABSOLUTE_LIFETIME_DEFAULT_MS,
			}),
		).toEqual({ ok: true });
	});
});
