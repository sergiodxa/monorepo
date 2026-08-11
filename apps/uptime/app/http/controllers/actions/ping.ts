/**
 * The dashboard's quick-check action: `POST /actions/:team/run-ping`. Takes a URL typed
 * into the dashboard form, probes it once with the same `HttpCheck` a monitor's
 * scheduled check uses, and hands the result back through the session so the dashboard
 * can render it. Nothing is stored, no monitor is created or touched, and no alert is
 * evaluated — the same contract `POST /api/v1/ping` offers, reached from the UI instead
 * of from a key.
 *
 * Only HTTP. The API surface also offers DNS and TCP pings, but a URL box is the shape
 * of an HTTP question, and asking one control to also accept a bare domain or a
 * `host:port` would make the field mean three things depending on what was typed into
 * it.
 *
 * The result travels through the session rather than as a rendered response, because
 * this is a plain form post: the action redirects back to the dashboard, so a refresh
 * cannot re-run (and re-bill) the check, and the quick-check fragment is the one place
 * that knows how to render the result next to the form that asked for it. See
 * {@link QUICK_PING_RESULT} for why it is a plain value and not a flash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
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
 * Defaults the quick check probes with. Deliberately not configurable from the
 * dashboard: the form asks one question — "does this URL answer?" — and every control
 * added to it is a control that makes the answer slower to get. A caller who needs to
 * vary the method, the expected status or the region has `POST /api/v1/ping`, which
 * takes all of them.
 *
 * `GET` rather than the monitors' `HEAD` default, because a URL typed in by hand is
 * usually a page or a healthcheck endpoint, and some of those answer `HEAD` with a 405
 * that says nothing about whether the service is up.
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
 * A refusal, reported where a result would have been.
 *
 * It travels the same way a result does — stored for the quick-check fragment to render —
 * rather than being flashed for the page shell to draw, because that fragment is the only
 * thing the scripted path re-renders: the form island reloads its own frame and nothing
 * else, so a message flashed here would go unseen and then surface, stale, on whatever
 * page happened to load next. Carrying a code rather than a message keeps the stored value
 * free of a language choice made in a different request.
 */
export interface QuickPingError {
	kind: "error";
	/**
	 * This submission's id. It is what tells one answer apart from the answer before it,
	 * which the fragment needs because the toast it renders is patched into a bar that is
	 * already on screen rather than built fresh: two answers that read the same would
	 * otherwise be the same element, still holding the finished state of its own fade.
	 */
	id: string;
	code: QuickPingErrorCode;
}

/** Either outcome the fragment can be asked to render. */
export type QuickPingOutcome = QuickPingResult | QuickPingError;

/**
 * Session key the quick-check fragment reads a {@link QuickPingOutcome} from.
 *
 * Deliberately a plain session value rather than a flash, even though "show it once" is
 * exactly what a flash is for. A delivered flash marks the session dirty the moment it
 * is loaded, and the session middleware saves after the handler returns — which, for the
 * no-JavaScript path, is the *dashboard document* request, whose save runs before its
 * streamed frames have resolved. The flash would be cleared before the fragment that
 * needs it ever ran, and the check's answer would never reach the page. A plain value leaves
 * that request clean, so it saves nothing, and the fragment removes the value itself.
 */
export const QUICK_PING_RESULT = "pingResult";

/**
 * POST /actions/:team/run-ping — probes one URL and hands the result to the dashboard.
 *
 * Bakes its own `requireUser`/`requireTeam` chain in rather than taking one from the
 * router, because this is a single `Route` and not a `RouteMap` — the same shape
 * `setDashboardTab` uses for the same reason.
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
		 * A quick check is billed exactly like a scheduled one, so it is gated exactly like
		 * one: `stateFor`, not `isActive`, so an owner whose subscription state cannot be
		 * determined still gets their check. Matches the manual "run check" button.
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

		recordAdhocPing({
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
