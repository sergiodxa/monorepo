/**
 * Client island: a real `<form>` posts to the run action so it works with no
 * JS; once hydrated, `on("submit")` intercepts it to `fetch()` the same action
 * instead, keeping the button pending — a flow run can take most of thirty
 * seconds, long enough that a bare navigation would read as a hung page.
 *
 * The toast names the failing test and line, the one signal a flow run has
 * that no other monitor type does. Its label reads through `intl(handle)`
 * rather than `ctx.i18next.t`, since it also renders server-side with no
 * request-scoped `ctx.i18next` to read from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { intl } from "@sdxc/i18n/ui";
import { PlayIcon } from "@sdxc/icons";
import { m } from "@sdxc/u/size";
import { Button } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { clientEntry, on } from "remix/ui";

import type { AppToast } from "~/resources/components/app-toaster";

import { showToast } from "~/resources/components/app-toaster";

/**
 * The action's JSON answer: one flat shape rather than a union of "refused"
 * and "ran", since a `null` status already tells the two apart — the
 * alternative needs a discriminant this schema library doesn't narrow on.
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
 * The toast a finished run deserves: three outcomes, three colours. `error`
 * warns about the monitor's own ability to run, distinct from an outage of
 * the thing it watches, and its `detail` names the reason why.
 */
export function runToast(t: TFunction, name: string, run: RunResponse): AppToast {
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
							void handle.update();

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
								/** A failed request has no outcome to report, so this stays silent rather than risking a wrong toast. */
							} finally {
								pending = false;
								void handle.update();
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
