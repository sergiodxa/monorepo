/**
 * An animated walk through one flow monitor run: the schedule fires, each step of the spec
 * passes in order along a rail, and the run settles as passed. The steps are the sign-in
 * flow the flow monitor docs teach, so the diagram shows the product's own syntax.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BellIcon, ClockIcon } from "@sdxc/icons";
import { FlowDiagram as RunDiagram } from "@sdxc/ui/patterns";

/** The lines of the documented sign-in flow each step shows, in run order. */
const STEP_CODE = [
	'http.post "/api/sessions" form { … }',
	"session.json.token",
	'http.get "/v1/account" bearer session.json.token',
	"expect account.status 200",
] as const;

namespace FlowDiagram {
	export interface Props {
		/** Translated captions: the diagram's name, the pause toggle, and each step. */
		labels: {
			name: string;
			pause: string;
			schedule: string;
			scheduleDetail: string;
			steps: [string, string, string, string];
			passed: string;
			alert: string;
		};
		/**
		 * The spec line under each step, in run order; the documented HTTP sign-in flow when
		 * omitted, so a page about another kind of flow shows its own syntax.
		 */
		code?: readonly [string, string, string, string];
	}
}

/**
 * Renders the run with the schedule as its trigger and the alert as its footnote. Without
 * motion every step shows as passed, so the static picture is the finished run.
 */
export default function FlowDiagram(handle: Handle<FlowDiagram.Props>) {
	return () => {
		let { labels, code = STEP_CODE } = handle.props;

		return (
			<RunDiagram
				aria-label={labels.name}
				pauseLabel={labels.pause}
				trigger={{
					icon: <ClockIcon size={14} aria-hidden="true" />,
					title: labels.schedule,
					detail: labels.scheduleDetail,
				}}
				steps={code.map((line, index) => ({ title: labels.steps[index], code: line }))}
				outcome={labels.passed}
				footnote={
					<>
						<BellIcon size={14} aria-hidden="true" />
						{labels.alert}
					</>
				}
			/>
		);
	};
}
