/**
 * A feed of sign-in flow monitor runs landing on the fastest schedule: runs keep passing,
 * one fails at its check step and prints that spec line, and the next run recovers. Pages
 * selling flow monitors share it, so every one shows the same moment in the same words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { EventTicker } from "@sdxc/ui/patterns";

import { FLOW_INTERVALS_SECONDS } from "~/config/pricing";

/** Steps in the documented sign-in flow every run walks. */
const STEP_COUNT = 4;

/** Clock time of the oldest run, in minutes after midnight, so the feed reads as noon. */
const FIRST_RUN_MINUTES = 12 * 60;

/**
 * The failing run's check line as the spec states it, then what came back. The DSL is
 * English by design, so it stays a constant rather than a locale string.
 */
const FAILED_LINE = "expect account.status 200 → got 401";

/**
 * Formats the clock time of the run `index` intervals after the first, in 24-hour mono
 * time, so the gaps between rows always equal the advertised schedule.
 */
function runTime(index: number) {
	let total = FIRST_RUN_MINUTES + index * (FLOW_INTERVALS_SECONDS[0] / 60);
	let hours = Math.floor(total / 60) % 24;
	let minutes = total % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

namespace FlowRunsTicker {
	export interface Props {
		t: Translate;
	}
}

/**
 * Renders three passing runs, the run that fails at its last step with the failing line,
 * and a running one that settles as recovered while it is on screen.
 */
export default function FlowRunsTicker(handle: Handle<FlowRunsTicker.Props>) {
	return () => {
		let { t } = handle.props;
		let label = t("landing.flows.runs.label");

		return (
			<EventTicker
				aria-label={t("landing.flows.runs.name")}
				pauseLabel={t("landing.flows.diagram.pause")}
				title={t("landing.flows.runs.title", { minutes: FLOW_INTERVALS_SECONDS[0] / 60 })}
				statusLabels={{
					ok: t("landing.flows.runs.statuses.ok"),
					warn: t("landing.flows.runs.statuses.warn"),
					fail: t("landing.flows.runs.statuses.fail"),
					pending: t("landing.flows.runs.statuses.pending"),
				}}
				rows={[
					{
						time: runTime(0),
						label,
						status: "ok",
						detail: t("landing.flows.runs.passed", { steps: STEP_COUNT, seconds: 1.2 }),
					},
					{
						time: runTime(1),
						label,
						status: "ok",
						detail: t("landing.flows.runs.passed", { steps: STEP_COUNT, seconds: 1.1 }),
					},
					{
						time: runTime(2),
						label,
						status: "ok",
						detail: t("landing.flows.runs.passed", { steps: STEP_COUNT, seconds: 1.3 }),
					},
					{
						time: runTime(3),
						label: t("landing.flows.runs.failed", { step: STEP_COUNT, steps: STEP_COUNT }),
						status: "fail",
						code: FAILED_LINE,
					},
					{
						time: runTime(4),
						label,
						status: "pending",
						detail: t("landing.flows.runs.running", { step: 2, steps: STEP_COUNT }),
						flipTo: {
							status: "ok",
							detail: t("landing.flows.runs.recovered", { steps: STEP_COUNT, seconds: 1.2 }),
						},
					},
				]}
				footnote={t("landing.flows.runs.footnote")}
			/>
		);
	};
}
