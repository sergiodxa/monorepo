/**
 * Client island: a real `<form>` posting to the "check flow monitor" action, so it works with no
 * JS at all (a plain navigating submit) — `on("submit")` only runs once hydrated, where it
 * intercepts the submit to `fetch()` the same action instead, keeps the button pending, and
 * reports the outcome as a toast.
 *
 * Unlike the HTTP monitors' run button, there is nothing to poll. A flow runs **inline**, so the
 * request that starts it is the request that answers with the result — which is also why the
 * hydrated path matters more here than there: a flow may take most of thirty seconds (the run's
 * own ceiling), and holding a navigation open for that long would read as a hung page. The button
 * spins, then the toast says what happened.
 *
 * The toast carries the failing test and its line rather than only a colour, because that is the
 * one thing a flow knows that no other monitor type does — "the sign-in form authenticates failed
 * on line 9" is the whole reason somebody pressed the button.
 *
 * Its label reads through `@pkg/i18n/ui`'s `intl(handle)` rather than `ctx.i18next.t`, since this
 * component runs both server-side (the no-JS baseline markup) and client-side (after hydration)
 * and has no access to the request-scoped `ctx.i18next` instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n as I18n } from "i18next";
import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { PlayIcon } from "@pkg/lucide-remix";
import { m } from "@pkg/u/size";
import { Button } from "@pkg/ui";
import * as s from "remix/data-schema";
import { clientEntry, on } from "remix/ui";

import type { AppToast } from "~/resources/components/app-toaster";

import { showToast } from "~/resources/components/app-toaster";

/**
 * The action's JSON answer.
 *
 * One flat shape rather than a union of "refused" and "ran", because a `null` status already says
 * which: a run that never happened has no status to report, only a `reason`. The alternative is a
 * discriminant this schema library does not narrow on, and a shape that needs a type assertion to
 * read is worse than one extra nullable field.
 */
const RunResponseSchema = s.object({
	/** What the run concluded, or `null` when it never ran. */
	status: s.nullable(s.enum_(["up", "down", "error"])),
	/** Why it never ran. Only set alongside a `null` status. */
	reason: s.nullable(s.string()),
	testsPassed: s.number(),
	testsTotal: s.number(),
	requestsMade: s.number(),
	durationMs: s.nullable(s.number()),
	failedTest: s.nullable(s.string()),
	failedAtLine: s.nullable(s.number()),
	detail: s.nullable(s.string()),
});

/** What the action answered, once parsed. */
type RunResponse = s.InferOutput<typeof RunResponseSchema>;

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RunFlowButtonProps = {
	action: string;
	monitorId: string;
	/** The monitor's name, interpolated into the toast copy. */
	name: string;
};

/**
 * The toast a finished run deserves.
 *
 * Three outcomes, three colours, and the middle one is the reason this is a function rather than a
 * ternary: `error` is not an outage — the flow could not be run at all — so it is a warning about
 * the monitor rather than a failure of the thing it watches, and its detail is the only place that
 * says which.
 */
export function runToast(t: I18n["t"], name: string, run: RunResponse): AppToast {
	if (run.status === null) {
		return {
			title: t("page.flowMonitors.run.toast.refused", { name }),
			description: run.reason ?? "",
			color: "danger",
		};
	}

	let description =
		run.failedTest === null
			? t("page.flowMonitors.run.toast.summary", {
					passed: run.testsPassed,
					total: run.testsTotal,
					requests: run.requestsMade,
					duration: run.durationMs ?? 0,
				})
			: t("page.flowMonitors.run.toast.failedTest", {
					test: run.failedTest,
					line: run.failedAtLine ?? 0,
				});

	if (run.status === "up") {
		return { title: t("page.flowMonitors.run.toast.up", { name }), description, color: "success" };
	}
	if (run.status === "error") {
		return {
			title: t("page.flowMonitors.run.toast.error", { name }),
			description: run.detail ?? description,
			color: "warning",
		};
	}
	return { title: t("page.flowMonitors.run.toast.down", { name }), description, color: "danger" };
}

/** Posts the run action, spinning until the flow finishes, then toasting its outcome. */
export const RunFlowButton = clientEntry(
	"/resources/components/run-flow-button.tsx#RunFlowButton",
	function RunFlowButton(handle: Handle<RunFlowButtonProps>) {
		let pending = false;

		return () => {
			let t = intl(handle).t;

			return (
				<form
					method="post"
					action={handle.props.action}
					mix={[
						m(0),
						on("submit", async (event) => {
							event.preventDefault();
							let body = new FormData(event.currentTarget);
							/**
							 * The island's own signal, not the render-scoped one: `handle.update()` below
							 * aborts the latter, and this flow outlives several updates.
							 */
							let signal = handle.signal;

							pending = true;
							handle.update();

							try {
								let response = await fetch(handle.props.action, {
									method: "POST",
									credentials: "same-origin",
									headers: { accept: "application/json" },
									body,
									signal,
								});
								if (!response.ok) return;

								let run = s.parse(RunResponseSchema, await response.json());
								showToast(runToast(t, handle.props.name, run));
							} catch {
								// A failed request says nothing rather than something wrong.
							} finally {
								pending = false;
								handle.update();
							}
						}),
					]}
				>
					<input type="hidden" name="monitor_id" value={handle.props.monitorId} />
					<Button type="submit" color="neutral" isPending={pending} disabled={pending}>
						<PlayIcon size={16} strokeWidth={1.5} />
						{t("page.flowMonitors.run.cta")}
					</Button>
				</form>
			);
		};
	},
);

export default RunFlowButton;
