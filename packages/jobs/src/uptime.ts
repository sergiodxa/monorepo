/**
 * The cron-monitor ping, as a client a dispatcher's `onEnd` calls. It is wired to nothing:
 * reporting is the app's, so a service having a bad minute cannot become a reason to
 * redeliver work that already succeeded, and the `Result` is what makes discarding that
 * outcome an act rather than an oversight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** The service a monitor lives on unless a caller names another. */
const UPTIME_URL = new URL("https://uptime.sergiodxa.com");

/** Normalized reason a ping did not land. */
export type UptimeErrorCode =
	/** The service answered, and refused the ping. */
	| "refused"
	/** The ping never got an answer. */
	| "unreachable"
	/** No token resolved, so nothing was sent. */
	| "unconfigured";

/** What the reporter states about a failure when it constructs the error. */
export interface UptimeErrorOptions extends ErrorOptions {
	code: UptimeErrorCode;
	monitorId: string;
	/** The status the service refused with, for a `refused` failure. */
	status?: number;
}

/**
 * Failure carried by every ping `Result`.
 *
 * `unconfigured` is the one worth acting on outside a run: a token that never arrived
 * means no monitor is being told anything, which is the silence a monitor exists to break.
 */
export class UptimeError extends Error {
	override name = "UptimeError";

	readonly code: UptimeErrorCode;

	/** The monitor the ping was for. */
	readonly monitorId: string;

	readonly status: number | undefined;

	/**
	 * @param message What went wrong, for a log or a rethrow.
	 * @param options The code, the monitor, and the original error as `cause`.
	 */
	constructor(message: string, { code, monitorId, status, ...options }: UptimeErrorOptions) {
		super(message, options);
		this.code = code;
		this.monitorId = monitorId;
		this.status = status;
	}
}

/** What a reporter needs to reach the service. */
export interface UptimeReporterOptions {
	/**
	 * Resolves the bearer token per call, so importing a dispatcher reads no binding and a
	 * token rotated between runs is picked up.
	 */
	token: () => string | undefined;
	/** @default https://uptime.sergiodxa.com */
	url?: URL;
}

/**
 * Builds the reporter a completed run pings its monitor through. Bound to a token once, so a
 * call site holds a monitor id and nothing else.
 *
 * @param options The token, and the service to reach.
 * @returns Sends one monitor's ping, answering with whether it landed.
 * @example
 * const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });
 * await uptime(sweep.meta.monitorId);
 */
export function createUptimeReporter(
	options: UptimeReporterOptions,
): (monitorId: string) => Promise<Result<void, UptimeError>> {
	let base = options.url ?? UPTIME_URL;

	return async function ping(monitorId: string): Promise<Result<void, UptimeError>> {
		let token = options.token();

		if (token === undefined) {
			return failure(
				new UptimeError("No uptime token resolved, so no ping was sent", {
					code: "unconfigured",
					monitorId,
				}),
			);
		}

		let url = new URL(`/api/v1/cron-jobs/${monitorId}/ping`, base);

		let headers = new Headers();
		headers.set("Authorization", `Bearer ${token}`);
		headers.set("Content-Type", "application/json");

		let response: Response;

		try {
			response = await fetch(url, { method: "POST", headers });
		} catch (error) {
			return failure(
				new UptimeError("The ping never got an answer", {
					code: "unreachable",
					monitorId,
					cause: error instanceof Error ? error : undefined,
				}),
			);
		}

		if (response.ok) return success(undefined);

		return failure(
			new UptimeError(`The service refused the ping with status ${response.status}`, {
				code: "refused",
				monitorId,
				status: response.status,
			}),
		);
	};
}
