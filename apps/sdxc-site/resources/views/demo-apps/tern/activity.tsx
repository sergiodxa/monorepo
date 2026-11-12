/**
 * What Tern did before a reply, drawn as the reply's "Thought for" disclosure: its plan, then
 * each search, read and command with a glyph for its kind, a command opening onto its
 * output. It opens while the reply streams, so its steps appear as the replay reaches them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { FileSearchIcon, GlobeIcon, TerminalIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Activity } from "@sdxc/ui/chat";

import type { ActivityStep, TurnActivity } from "~/resources/views/demo-apps/tern/data";

/** The glyph a step draws for its kind; a thinking step goes without. */
function stepIcon(kind: ActivityStep["kind"]): RemixNode | undefined {
	if (kind === "search") return <GlobeIcon size={16} aria-hidden="true" />;
	if (kind === "read") return <FileSearchIcon size={16} aria-hidden="true" />;
	if (kind === "run") return <TerminalIcon size={16} aria-hidden="true" />;
	return undefined;
}

/** What a step opens onto: its output as a terminal block, or its commands as a boxed run. */
function stepDetail(step: ActivityStep): RemixNode | undefined {
	if (step.output !== undefined) {
		return (
			<pre
				mix={[
					raw({
						margin: 0,
						padding: "0.75rem 0.875rem",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-neutral-bg-tint)",
						border: "1px solid var(--ui-neutral-border)",
						fontFamily: "var(--ui-font-mono)",
						fontSize: "0.8125rem",
						lineHeight: "1.5",
						whiteSpace: "pre-wrap",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{step.output}
			</pre>
		);
	}
	if (step.runs !== undefined) {
		return (
			<Activity.Steps boxed>
				{step.runs.map((command) => (
					<Activity.Step>
						Ran <code>{command}</code>
					</Activity.Step>
				))}
			</Activity.Steps>
		);
	}
	return undefined;
}

namespace TurnActivityView {
	export interface Props {
		activity: TurnActivity;
		/** Opens the disclosure, for the reply streaming in. */
		open: boolean;
	}
}

/** Renders a reply's activity as a "Thinking" disclosure. */
export function TurnActivityView(handle: Handle<TurnActivityView.Props>) {
	return () => {
		let { activity, open } = handle.props;
		return (
			<Activity open={open}>
				<Activity.Summary busy="Thinking">Thought for {activity.seconds}s</Activity.Summary>
				{activity.note === undefined ? null : <Activity.Note>{activity.note}</Activity.Note>}
				<Activity.Steps>
					{activity.steps.map((step) => (
						<Activity.Step icon={stepIcon(step.kind)} detail={stepDetail(step)} duration={step.ms}>
							{step.label}
						</Activity.Step>
					))}
				</Activity.Steps>
			</Activity>
		);
	};
}
