/**
 * The small pieces every CI screen draws: a run's or job's state as an icon read by shape as
 * well as tone, a branch as a mono pill, and a person's handle beside their initials, so the
 * runs list, a run's summary, its job graph and the dashboard all say the same thing the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleDashedIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text } from "@sdxc/u/typography";
import { CheckRunIcon } from "@sdxc/ui/app/check-runs";

import type { JobState, RunStatus } from "../seed/actions";

import { LOG_LABELS } from "../labels";

namespace StateIcon {
	export interface Props {
		state: JobState | RunStatus;
	}
}

/**
 * Renders a run's or a job's state: ✓ success, ✗ failure, a pulsing ● while it runs, a dashed
 * ring while it waits for a runner, ⊘ skipped and ⊖ cancelled, each announced by name.
 */
export function StateIcon(handle: Handle<StateIcon.Props>) {
	return () => {
		let { state } = handle.props;
		let job: JobState = state === "in_progress" ? "running" : state;
		let label = LOG_LABELS.states[job];
		if (job === "queued") {
			return (
				<span
					role="img"
					aria-label={label}
					data-state="queued"
					mix={[raw({ display: "inline-flex", flexShrink: 0 }), fg("neutral.muted")]}
				>
					<CircleDashedIcon size={16} aria-hidden="true" />
				</span>
			);
		}
		return <CheckRunIcon state={job === "running" ? "pending" : job} label={label} />;
	};
}

/** Renders a branch name as the mono pill a code host draws refs in. */
export function BranchPill(handle: Handle<{ name: string }>) {
	return () => (
		<span
			data-slot="delta-branch"
			title={handle.props.name}
			mix={[
				font("mono"),
				text("xs"),
				fg("brand"),
				raw({
					display: "inline-block",
					maxInlineSize: "100%",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					paddingInline: "0.375rem",
					lineHeight: "1.25rem",
					borderRadius: "var(--ui-radius-md)",
					background: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
					verticalAlign: "middle",
				}),
			]}
		>
			{handle.props.name}
		</span>
	);
}
