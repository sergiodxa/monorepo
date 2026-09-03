/**
 * The dashboard's quick-check action: `POST /actions/:team/run-ping`. Probes a
 * submitted URL once with the same `HttpCheck` a monitor's scheduled check
 * uses, matching `POST /api/v1/ping`'s contract without storing anything or
 * touching a monitor. HTTP only: a URL box asks an HTTP question, so DNS and
 * TCP targets stay on the API surface that takes them explicitly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { generateUUID } from "@sdxc/uuid";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorStatus } from "~/database/schema";

import Subscription from "~/app/data/subscription";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { RunPingSchema } from "~/app/http/validators/ping";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apportionCostByTeam } from "~/app/services/cost";
import { HttpCheck } from "~/app/services/http-check";
import routes from "~/routes/web";

/**
 * Fixed defaults for the quick check; `POST /api/v1/ping` exposes the tunable
 * version for a caller that needs another method, status, or region. GET
 * matches what a hand-typed URL usually is: a page or health endpoint that answers GET.
 */
const QUICK_CHECK = {
	method: "GET",
	expectedStatus: 200,
	degradedAfterMs: 5000,
	timeoutSeconds: 10,
	locationHint: "wnam",
} as const;

/**
 * What the dashboard renders after a quick check, stored under {@link QUICK_PING_RESULT}.
 * Carries the URL back too: the redirect clears the form, so without it the result would
 * be a status with nothing to attribute it to.
 */
export interface QuickPingResult {
	kind: "result";
	/** This submission's id; see {@link QuickPingError.id} for what the fragment does with it. */
	id: string;
	url: string;
	status: MonitorStatus;
	/** `null` when the target never answered, which is what distinguishes it from a 0. */
	responseStatus: number | null;
	responseTimeMs: number | null;
}

/** Why a submitted check never ran. */
export type QuickPingErrorCode = "invalidUrl" | "subscriptionRequired";

/**
 * A refusal, reported where a result would have been. The quick-check
 * fragment renders it straight from storage on the scripted path, and it
 * carries a code so the message text is chosen at render time.
 */
export interface QuickPingError {
	kind: "error";
	/**
	 * This submission's id, distinguishing one answer from the one before it:
	 * the toast patches into a bar already on screen, so two answers that read
	 * the same would reuse the same element and its already-finished fade.
	 */
	id: string;
	code: QuickPingErrorCode;
}

/** Either outcome the fragment can be asked to render. */
export type QuickPingOutcome = QuickPingResult | QuickPingError;

/**
 * Session key the quick-check fragment reads a {@link QuickPingOutcome} from.
 * A plain value: the no-JavaScript path's session save finishes before the
 * streamed dashboard frames resolve, so the value survives for the fragment to read.
 */
export const QUICK_PING_RESULT = "pingResult";

/**
 * POST /actions/:team/run-ping — probes one URL and hands the result to the
 * dashboard. Defined as a standalone `Route` — the same shape `setDashboardTab`
 * uses — so it supplies its own `requireUser`/`requireTeam` chain directly.
 */
export const runPing = createAction(routes.actions.runPing, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let session = ctx.get(Session);
		let dashboard = routes.app.team.dashboard.index.href({ team: ctx.team.slug });
		let back = redirect(dashboard, { status: redirect.Status.SeeOther });

		/**
		 * One id for this submission, minted before it is known whether there will be a check
		 * to bill for: every path out of here stores an answer, and every answer has to be
		 * distinguishable from the one it replaces on the dashboard.
		 */
		let id = generateUUID();

		let result = await validate(ctx.formData, RunPingSchema);
		if (isFailure(result)) {
			session?.set(QUICK_PING_RESULT, { kind: "error", id, code: "invalidUrl" });
			return back;
		}

		/**
		 * A quick check is billed exactly like a scheduled one, so it is gated with
		 * `stateFor`: an owner whose subscription state can't be determined still
		 * gets their check, matching the manual "run check" button.
		 */
		let db = getServiceContainer().get(Database);
		if ((await Subscription.stateFor(db, ctx.team.owner_id)) === "inactive") {
			session?.set(QUICK_PING_RESULT, { kind: "error", id, code: "subscriptionRequired" });
			return back;
		}

		/** Everything this request costs belongs to the team that asked for it (ADR-007 §5). */
		apportionCostByTeam([ctx.team.id]);

		let check = new HttpCheck({
			...QUICK_CHECK,
			url: result.data.url,
			/**
			 * The URL, so re-checking the same target keeps hitting the same warm Durable
			 * Object — a person poking at one deploy will submit this form several times in a
			 * row.
			 */
			shardKey: result.data.url,
			contentChecks: [],
		});

		let outcome = await check.probe();
		let status = check.classify(outcome, true);

		recordAdhocPing(ctx.billing, {
			id,
			team: ctx.team,
			status,
			responseTimeMs: outcome.responseTimeMs ?? 0,
		});

		session?.set(QUICK_PING_RESULT, {
			kind: "result",
			id,
			url: result.data.url,
			status,
			responseStatus: outcome.responseStatus,
			responseTimeMs: outcome.responseTimeMs,
		});

		return back;
	},
});
