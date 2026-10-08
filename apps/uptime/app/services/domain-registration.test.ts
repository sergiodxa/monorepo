/**
 * Unit tests for the registration rules: how each lookup outcome becomes the monitor's
 * stored state and next lookup time, how an outage keeps alerting from a stored date, and
 * which states and EPP statuses warrant an alert.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RDAP } from "@sdxc/rdap";

import { DAY_MS } from "@sdxc/dates/zone";
import { RDAPError } from "@sdxc/rdap";
import { failure, success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { RegistrationState } from "./domain-registration";

import {
	registrationIsDown,
	registrationOutcome,
	shouldAlertOnRegistration,
} from "./domain-registration";

const NOW = Date.UTC(2026, 9, 8, 12);
const HOUR_MS = 60 * 60 * 1000;

/** A monitor never looked up, with the default 30-day window. */
function state(overrides: Partial<RegistrationState> = {}): RegistrationState {
	return {
		registration_status: "unknown",
		registration_expires_at: null,
		registration_warning_days: 30,
		registration_checked_at: null,
		registration_failures: 0,
		...overrides,
	};
}

/** A registry answer expiring `days` from {@link NOW}. */
function domain(days: number | null, status: string[] = ["clientTransferProhibited"]): RDAP.Domain {
	return {
		name: "acme-widgets.com",
		unicodeName: null,
		handle: null,
		expiresAt: days === null ? null : NOW + days * DAY_MS,
		registeredAt: null,
		updatedAt: null,
		status,
		registrar: { name: "Example Registrar, LLC", ianaId: "9999", abuseEmail: null },
		nameservers: [],
		dnssec: null,
		relatedUrl: null,
		server: "https://rdap.verisign.com/com/v1/domain/acme-widgets.com",
		document: {},
	};
}

describe("registrationOutcome", () => {
	test("a success stores the registry's answer and schedules the next lookup a day later", () => {
		let patch = registrationOutcome(state(), success(domain(200)), NOW);

		expect(patch).toEqual({
			registration_status: "valid",
			registration_expires_at: NOW + 200 * DAY_MS,
			registration_epp_statuses: ["clientTransferProhibited"],
			registrar: "Example Registrar, LLC",
			registration_checked_at: NOW,
			registration_error: null,
			registration_failures: 0,
			registration_next_check_at: NOW + DAY_MS,
		});
	});

	test("classifies against the monitor's own warning window", () => {
		let patch = registrationOutcome(
			state({ registration_warning_days: 60 }),
			success(domain(45)),
			NOW,
		);
		expect(patch.registration_status).toBe("expiring");
	});

	test("a registry that publishes no expiry leaves the status unknown", () => {
		let patch = registrationOutcome(state(), success(domain(null)), NOW);
		expect(patch.registration_status).toBe("unknown");
		expect(patch.registration_expires_at).toBeNull();
	});

	test.each(["not-found", "unsupported-tld"] as const)(
		"%s is unavailable and asked again in a week",
		(code) => {
			let patch = registrationOutcome(
				state({ registration_failures: 3 }),
				failure(new RDAPError(code, code)),
				NOW,
			);

			expect(patch).toEqual({
				registration_status: "unavailable",
				registration_error: code,
				registration_failures: 0,
				registration_next_check_at: NOW + 7 * DAY_MS,
			});
		},
	);

	test("an outage keeps the stored date and retries with a growing backoff", () => {
		let first = registrationOutcome(
			state({
				registration_status: "valid",
				registration_expires_at: NOW + 200 * DAY_MS,
				registration_checked_at: NOW - DAY_MS,
			}),
			failure(new RDAPError("server-error", "503")),
			NOW,
		);

		expect(first.registration_status).toBe("valid");
		expect(first.registration_error).toBe("server-error");
		expect(first.registration_failures).toBe(1);
		expect(first.registration_expires_at).toBeUndefined();
		expect(first.registration_next_check_at - NOW).toBeGreaterThanOrEqual(0.9 * HOUR_MS);
		expect(first.registration_next_check_at - NOW).toBeLessThanOrEqual(1.1 * HOUR_MS);

		let later = registrationOutcome(
			state({ registration_failures: 10, registration_checked_at: NOW - DAY_MS }),
			failure(new RDAPError("timeout", "timeout")),
			NOW,
		);
		expect(later.registration_next_check_at - NOW).toBeLessThanOrEqual(1.1 * DAY_MS);
	});

	test("waits out a Retry-After longer than the backoff", () => {
		let patch = registrationOutcome(
			state({ registration_checked_at: NOW }),
			failure(new RDAPError("rate-limited", "429", { retryAfter: 5 * HOUR_MS })),
			NOW,
		);
		expect(patch.registration_next_check_at).toBe(NOW + 5 * HOUR_MS);
	});

	test("an outage inside the warning window keeps alerting from the stored date", () => {
		let patch = registrationOutcome(
			state({
				registration_status: "valid",
				registration_expires_at: NOW + 5 * DAY_MS,
				registration_checked_at: NOW - 40 * DAY_MS,
			}),
			failure(new RDAPError("network", "network")),
			NOW,
		);
		expect(patch.registration_status).toBe("expiring");
	});

	test("turns error once no lookup has succeeded within the warning window", () => {
		let recent = registrationOutcome(
			state({ registration_status: "valid", registration_checked_at: NOW - 10 * DAY_MS }),
			failure(new RDAPError("network", "network")),
			NOW,
		);
		let stale = registrationOutcome(
			state({ registration_status: "valid", registration_checked_at: NOW - 31 * DAY_MS }),
			failure(new RDAPError("network", "network")),
			NOW,
		);
		let never = registrationOutcome(state(), failure(new RDAPError("refused", "403")), NOW);

		expect(recent.registration_status).toBe("valid");
		expect(stale.registration_status).toBe("error");
		expect(never.registration_status).toBe("error");
	});
});

describe("shouldAlertOnRegistration", () => {
	test("follows the expiry reminder schedule", () => {
		expect(shouldAlertOnRegistration("valid", "expiring", 14, [])).toBe(true);
		expect(shouldAlertOnRegistration("expiring", "expiring", 45, [])).toBe(false);
		expect(shouldAlertOnRegistration("expiring", "expired", -1, [])).toBe(true);
		expect(shouldAlertOnRegistration("unknown", "valid", 200, [])).toBe(false);
	});

	test.each(["redemptionPeriod", "pendingDelete", "clientHold", "serverHold"])(
		"alerts every day while the registry reports %s",
		(status) => {
			expect(shouldAlertOnRegistration("valid", "valid", 200, [status])).toBe(true);
		},
	);

	test("alerts once on entering error", () => {
		expect(shouldAlertOnRegistration("valid", "error", null, [])).toBe(true);
		expect(shouldAlertOnRegistration("error", "error", null, [])).toBe(false);
	});

	test("an unavailable registration never alerts", () => {
		expect(shouldAlertOnRegistration("unknown", "unavailable", null, [])).toBe(false);
	});
});

describe("registrationIsDown", () => {
	test("is down when expired or out of resolution, and a warning otherwise", () => {
		expect(registrationIsDown("expired", [])).toBe(true);
		expect(registrationIsDown("valid", ["clientHold"])).toBe(true);
		expect(registrationIsDown("expiring", ["clientTransferProhibited"])).toBe(false);
	});
});
