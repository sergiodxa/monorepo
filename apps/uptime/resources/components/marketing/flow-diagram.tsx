/**
 * An animated walk through one flow monitor run: the schedule fires, each step of the spec
 * passes in order along a rail, and the run settles as passed. The steps are the sign-in
 * flow the flow monitor docs teach, so the diagram shows the product's own syntax.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BellIcon, CheckIcon, ClockIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { MotionLoop } from "@sdxc/ui/patterns";
import { marketingSurface } from "@sdxc/ui/styles";

/** Length of one loop: the run plays, holds on its result, then resets. */
const CYCLE_SECONDS = 9;

/** Share of the cycle, in percent, at which the first step passes. */
const FIRST_STEP_AT = 12;

/** Percent of the cycle between one step passing and the next. */
const STEP_GAP = 13;

/** Percent of the cycle at which every lit element goes dark again for the next loop. */
const RESET_AT = 94;

/** Inline size of a step's status dot; the rail runs through the dots' centres. */
const DOT = "1.75rem";

/**
 * Room the schedule row keeps at its end for the pause toggle pinned to the surface's top
 * corner, so a caption that wraps on a phone stays clear of the button.
 */
const PAUSE_CLEARANCE = "2.75rem";

/** Space between rows, which each connector spans to reach the next dot. */
const ROW_GAP = "1.25rem";

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
 * Renders the run as an ordered list on a raised surface. Without motion, or before the
 * animation starts, every step shows as passed, so the static picture is the finished run.
 */
export default function FlowDiagram(handle: Handle<FlowDiagram.Props>) {
	return () => {
		let { labels, code: stepCode = STEP_CODE } = handle.props;
		let outcomeAt = FIRST_STEP_AT + stepCode.length * STEP_GAP;

		return (
			<MotionLoop pauseLabel={labels.pause} placement="start-end">
				<div
					mix={[
						marketingSurface(),
						raw({ display: "grid", gap: "1.5rem", padding: "clamp(1.25rem, 4cqi, 2rem)" }),
					]}
				>
					<ol
						aria-label={labels.name}
						mix={[
							raw({
								position: "relative",
								display: "grid",
								gap: "1.25rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						<li mix={[stepRow()]}>
							<span
								mix={[
									dot(),
									raw({ color: "var(--ui-brand-fg)", borderColor: "var(--ui-brand-border)" }),
								]}
							>
								<ClockIcon size={14} aria-hidden="true" />
							</span>
							<Connector index={-1} />
							<span
								mix={[
									raw({
										display: "grid",
										gap: "0.125rem",
										minInlineSize: "0",
										paddingInlineEnd: PAUSE_CLEARANCE,
									}),
								]}
							>
								<span mix={[caption()]}>{labels.schedule}</span>
								<span mix={[detail()]}>{labels.scheduleDetail}</span>
							</span>
						</li>
						{stepCode.map((code, index) => (
							<li key={code} mix={[stepRow()]}>
								<span mix={[dot(), stepDot(index)]}>
									<CheckIcon
										size={14}
										strokeWidth={2.5}
										aria-hidden="true"
										mix={[stepCheck(index)]}
									/>
								</span>
								{index < stepCode.length - 1 ? <Connector index={index} /> : null}
								<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
									<span mix={[caption()]}>{labels.steps[index]}</span>
									<code mix={[detail(), raw({ fontFamily: "var(--ui-font-mono)" })]}>{code}</code>
								</span>
							</li>
						))}
					</ol>

					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								justifyContent: "space-between",
								gap: "0.75rem",
								paddingBlockStart: "1.25rem",
								borderBlockStart:
									"1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
							}),
						]}
					>
						<span mix={[outcome(outcomeAt)]}>
							<CheckIcon size={14} strokeWidth={2.5} aria-hidden="true" />
							{labels.passed}
						</span>
						<span
							mix={[
								detail(),
								raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" }),
							]}
						>
							<BellIcon size={14} aria-hidden="true" />
							{labels.alert}
						</span>
					</div>
				</div>
			</MotionLoop>
		);
	};
}

namespace Connector {
	export interface Props {
		/** The row the line leaves from: `-1` for the schedule, else the step's index. */
		index: number;
	}
}

/**
 * The line from one row's dot to the next row's dot. It runs from under the dot to the
 * end of the row gap, where the next dot starts, so the line ends at the last check
 * however tall a row's text wraps. Its brand fill grows as the run moves to the next step.
 */
function Connector(handle: Handle<Connector.Props>) {
	return () => {
		let { index } = handle.props;
		let name = `uptime-flow-connector-${index + 1}`;
		let from = index < 0 ? FIRST_STEP_AT - STEP_GAP / 2 : passesAt(index);
		let to = passesAt(index + 1);

		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: DOT,
						insetBlockEnd: `calc(-1 * ${ROW_GAP})`,
						insetInlineStart: `calc(${DOT} / 2 - 1px)`,
						inlineSize: "2px",
						backgroundColor: "var(--ui-neutral-border)",
					}),
				]}
			>
				<span
					mix={[
						keyframes(name, {
							"0%": { transform: "scaleY(0)" },
							[`${from}%`]: { transform: "scaleY(0)" },
							[`${to}%`]: { transform: "scaleY(1)" },
							[`${RESET_AT}%`]: { transform: "scaleY(1)" },
							[`${RESET_AT + 2}%`]: { transform: "scaleY(0)" },
							"100%": { transform: "scaleY(0)" },
						}),
						raw({
							position: "absolute",
							inset: "0",
							backgroundColor: "var(--ui-success-bg-solid)",
							transformOrigin: "top",
						}),
						motionSafe(raw(loop(name))),
					]}
				/>
			</span>
		);
	};
}

/** The animation declarations every lit element shares: one linear loop of the cycle. */
function loop(name: string) {
	return {
		animationName: name,
		animationDuration: `${CYCLE_SECONDS}s`,
		animationTimingFunction: "linear",
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/** Percent of the cycle at which step `index` passes. */
function passesAt(index: number) {
	return FIRST_STEP_AT + index * STEP_GAP;
}

/**
 * Keyframe stops that hold `off` until `at`, switch to `on`, and go back to `off` at
 * {@link RESET_AT}, so every element of the run resets together.
 */
function litFrames(at: number, off: Record<string, string>, on: Record<string, string>) {
	return {
		"0%": off,
		[`${at - 1}%`]: off,
		[`${at}%`]: on,
		[`${RESET_AT}%`]: on,
		[`${RESET_AT + 2}%`]: off,
		"100%": off,
	};
}

/** A row of the run: the status dot, then the caption over its detail line. */
function stepRow() {
	return raw({
		position: "relative",
		display: "grid",
		gridTemplateColumns: `${DOT} minmax(0, 1fr)`,
		columnGap: "0.875rem",
		alignItems: "start",
	});
}

/** The round status marker a step's state reads from. */
function dot() {
	return raw({
		position: "relative",
		display: "grid",
		placeItems: "center",
		inlineSize: DOT,
		blockSize: DOT,
		borderRadius: "9999px",
		border: "1px solid var(--ui-neutral-border)",
		backgroundColor: "var(--ui-bg)",
	});
}

/** A step's dot, passed by default and lit in turn while the run animates. */
function stepDot(index: number) {
	let name = `uptime-flow-dot-${index}`;
	let on = {
		backgroundColor: "var(--ui-success-bg-solid)",
		borderColor: "var(--ui-success-bg-solid)",
	};
	let off = { backgroundColor: "var(--ui-bg)", borderColor: "var(--ui-neutral-border)" };

	return [
		keyframes(name, litFrames(passesAt(index), off, on)),
		raw({ ...on, color: "var(--ui-success-fg-on-solid)" }),
		motionSafe(raw(loop(name))),
	];
}

/** A step's check mark, shown once the step passes. */
function stepCheck(index: number) {
	let name = `uptime-flow-check-${index}`;

	return [
		keyframes(name, litFrames(passesAt(index), { opacity: "0" }, { opacity: "1" })),
		motionSafe(raw(loop(name))),
	];
}

/** The run's result, which appears after the last step passes. */
function outcome(at: number) {
	let name = "uptime-flow-outcome";

	return [
		keyframes(
			name,
			litFrames(
				at,
				{ opacity: "0", transform: "translateY(4px)" },
				{ opacity: "1", transform: "none" },
			),
		),
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			paddingInline: "0.625rem",
			paddingBlock: "0.25rem",
			borderRadius: "9999px",
			fontSize: "0.8125rem",
			fontWeight: "600",
			color: "var(--ui-success-fg)",
			backgroundColor: "var(--ui-success-bg-tint)",
		}),
		motionSafe(raw(loop(name))),
	];
}

/** A step's caption in the heading ink. */
function caption() {
	return raw({
		fontSize: "0.9375rem",
		lineHeight: "1.5rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}

/** The quieter line under a caption: the spec code, or the schedule. */
function detail() {
	return raw({
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
