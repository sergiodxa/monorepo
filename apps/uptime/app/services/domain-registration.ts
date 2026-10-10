/**
 * Domain registration expiry for DNS monitors (ADR-035): the RDAP client the sweep looks
 * domains up with, the rules that turn a lookup into the monitor's stored state and next
 * lookup time, and the policy for which states alert.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RDAPError } from "@sdxc/rdap";
import type { Result } from "@sdxc/result";

import { createBackoff } from "@sdxc/backoff";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { DAY_MS } from "@sdxc/dates/zone";
import { RDAP } from "@sdxc/rdap";
import { isSuccess, unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { UptimeModels } from "~/app/models";
import type { RegistrationStatus, SelectDnsMonitor } from "~/database/schema";

import { absoluteUrl } from "~/app/lib/origin";
import { classifyExpiry, shouldRemindOfExpiry } from "~/app/services/expiry";

/** How long a successful lookup is trusted before the next one. */
const LOOKUP_INTERVAL_MS = DAY_MS;

/** How long an answer that the registry holds no record, or runs no RDAP, stands before asking again. */
const UNAVAILABLE_INTERVAL_MS = 7 * DAY_MS;

/** Retries after a failed lookup: an hour at first, never more than the daily cadence. */
const RETRY_BACKOFF = createBackoff({ base: "1 hour", max: "1 day", jitter: 0.1 });

/** The `RDAPError` codes that answer about the name rather than report an outage. */
const UNAVAILABLE_CODES = new Set<RDAPError["code"]>(["not-found", "unsupported-tld"]);

/** EPP statuses meaning the domain has stopped, or is about to stop, resolving. */
const STOPS_RESOLVING = new Set<string>([
	"redemptionPeriod",
	"pendingDelete",
	"clientHold",
	"serverHold",
]);

/** Holds the isolate's one client once a sweep has asked for it. */
const CLIENT: { current?: RDAP } = {};

/**
 * The client every sweep in this isolate shares, built on first use so importing this
 * module reads no binding. Its IANA bootstrap copy is kept in KV, and in memory for the
 * client's lifetime, so a sweep reads it once.
 */
export function rdapClient(): RDAP {
	CLIENT.current ??= new RDAP({
		cache: new WorkerKVCache(env.KV),
		userAgent: `UptimeMonitor/1.0 (+${absoluteUrl("/")})`,
	});
	return CLIENT.current;
}

/** The stored fields a lookup outcome is decided from. */
export type RegistrationState = Pick<
	SelectDnsMonitor,
	| "registration_status"
	| "registration_expires_at"
	| "registration_warning_days"
	| "registration_checked_at"
	| "registration_failures"
>;

/** The columns one lookup writes, its next lookup time included. */
export interface RegistrationPatch {
	registration_status: RegistrationStatus;
	registration_expires_at?: number | null;
	registration_epp_statuses?: string[];
	registrar?: string | null;
	registration_checked_at?: number;
	registration_error: string | null;
	registration_failures: number;
	registration_next_check_at: number;
}

/**
 * Turns one lookup into the monitor's new state. A success replaces everything; a name the
 * registry does not hold is `unavailable` for a week; any other failure keeps the stored
 * date, alerting from it while it is inside the warning window, and turns `error` once no
 * lookup has succeeded within that window.
 *
 * @param state - The monitor's stored registration fields.
 * @param lookup - What the registry answered.
 * @param now - The time of the lookup, epoch ms.
 */
export function registrationOutcome(
	state: RegistrationState,
	lookup: Result<RDAP.Domain, RDAPError>,
	now: number,
): RegistrationPatch {
	if (isSuccess(lookup)) {
		let { status } = classifyExpiry(lookup.data.expiresAt, state.registration_warning_days);
		return {
			registration_status: status,
			registration_expires_at: lookup.data.expiresAt,
			registration_epp_statuses: lookup.data.status,
			registrar: lookup.data.registrar?.name ?? null,
			registration_checked_at: now,
			registration_error: null,
			registration_failures: 0,
			registration_next_check_at: now + LOOKUP_INTERVAL_MS,
		};
	}

	let error = lookup.error;
	if (UNAVAILABLE_CODES.has(error.code)) {
		return {
			registration_status: "unavailable",
			registration_error: error.code,
			registration_failures: 0,
			registration_next_check_at: now + UNAVAILABLE_INTERVAL_MS,
		};
	}

	let failures = state.registration_failures + 1;
	let retryAt = Math.max(RETRY_BACKOFF.at(failures, now), now + (error.retryAfter ?? 0));

	return {
		registration_status: statusDuringOutage(state, now),
		registration_error: error.code,
		registration_failures: failures,
		registration_next_check_at: retryAt,
	};
}

/**
 * The status a failed lookup leaves. A stored date inside the warning window keeps its
 * classification, so an outage never silences a real expiry; past that, `error` once the
 * last success is older than the window, since the app can no longer vouch for the date.
 */
function statusDuringOutage(state: RegistrationState, now: number): RegistrationStatus {
	let stored = classifyExpiry(state.registration_expires_at, state.registration_warning_days);
	if (stored.status === "expiring" || stored.status === "expired") return stored.status;

	let windowMs = state.registration_warning_days * DAY_MS;
	let lastSuccess = state.registration_checked_at;
	if (lastSuccess === null || now - lastSuccess > windowMs) return "error";

	return state.registration_status;
}

/**
 * Whether a registration warrants an alert today: the expiry reminder schedule
 * certificates use, every day while an EPP status says the domain stops resolving, and
 * once on entering `error`.
 *
 * @param previous - The status before this lookup.
 * @param current - The status after it.
 * @param daysUntilExpiry - Whole days left on the stored date, or `null`.
 * @param eppStatuses - The registry's EPP statuses.
 */
export function shouldAlertOnRegistration(
	previous: RegistrationStatus | null,
	current: RegistrationStatus,
	daysUntilExpiry: number | null,
	eppStatuses: readonly string[],
): boolean {
	if (current === "error") return previous !== "error";
	if (eppStatuses.some((status) => STOPS_RESOLVING.has(status))) return true;
	return shouldRemindOfExpiry(current, daysUntilExpiry);
}

/**
 * Whether the alert is the domain going down rather than a warning: it has expired, or the
 * registry has taken it out of resolution.
 */
export function registrationIsDown(
	status: RegistrationStatus,
	eppStatuses: readonly string[],
): boolean {
	return status === "expired" || eppStatuses.some((value) => STOPS_RESOLVING.has(value));
}

/** What one lookup reads about its monitor, beside the stored registration fields. */
export type RegistrationTarget = RegistrationState & Pick<SelectDnsMonitor, "id" | "domain">;

/** One looked-up monitor: the alert it warrants, if any, and the error code when the lookup failed. */
export interface RegistrationCheck {
	notification: NotifyMessage | null;
	error: string | null;
}

/**
 * Looks one monitor's domain up, persists the outcome, and builds the notification it
 * warrants, for the sweep and "Check now" alike. The days left are counted from the stored
 * date after the write, so a failed lookup inside the warning window still reminds.
 *
 * @param models - The models bound to the database the monitor lives in.
 * @param monitor - The monitor's id, domain and stored registration fields.
 * @returns The `notify` message to send, if any, and the failed lookup's error code.
 */
export async function checkRegistration(
	models: UptimeModels,
	monitor: RegistrationTarget,
): Promise<RegistrationCheck> {
	let now = Date.now();
	let lookup = await rdapClient().domain(monitor.domain);
	let patch = registrationOutcome(monitor, lookup, now);

	unwrap(await models.dnsMonitors.update(monitor.id, patch));

	let expiresAt =
		patch.registration_expires_at === undefined
			? monitor.registration_expires_at
			: patch.registration_expires_at;
	let { daysUntilExpiry } = classifyExpiry(expiresAt, monitor.registration_warning_days);
	let eppStatuses = isSuccess(lookup) ? lookup.data.status : [];

	let alert = shouldAlertOnRegistration(
		monitor.registration_status,
		patch.registration_status,
		daysUntilExpiry,
		eppStatuses,
	);

	return {
		error: isSuccess(lookup) ? null : lookup.error.code,
		notification: alert
			? {
					monitorType: "registration",
					monitorId: monitor.id,
					previousStatus: monitor.registration_status,
					newStatus: patch.registration_status,
				}
			: null,
	};
}
