/**
 * An animated walk through one automated run: a trigger fires, each step passes in order
 * along a rail, and the run settles on its outcome, then loops. It pictures a pipeline, a
 * scheduled check or an onboarding flow with the product's own step names and syntax.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

import { marketingSurface } from "../styles/marketing.js";

import { MotionLoop } from "./motion-loop.js";

/** Length of one loop: the run plays, holds on its outcome, then resets. */
const CYCLE_SECONDS = 9;

/** Share of the cycle, in percent, at which the first step passes. */
const FIRST_STEP_AT = 12;

/** Most percent of the cycle between one step passing and the next. */
const MAX_STEP_GAP = 13;

/** Percent of the cycle the steps share, so a long run still leaves time to hold its outcome. */
const STEPS_SPAN = 68;

/** Percent of the cycle at which every lit element goes dark again for the next loop. */
const RESET_AT = 94;

/** Inline size of a row's status dot; the rail runs through the dots' centres. */
const DOT = "1.75rem";

/**
 * Room the trigger row keeps at its end for the pause toggle pinned to the surface's top
 * corner, so a caption that wraps on a phone stays clear of the button.
 */
const PAUSE_CLEARANCE = "2.75rem";

/** Space between rows, which each connector spans to reach the next dot. */
const ROW_GAP = "1.25rem";

/**
 * Prop types for {@link FlowDiagram}.
 */
export namespace FlowDiagram {
	/** The row the run starts from, such as a schedule or a push. */
	export interface Trigger {
		/** Glyph inside the trigger's dot, drawn in the brand ink. */
		icon?: RemixNode;
		title: RemixNode;
		/** Quieter line under the title, such as the interval. */
		detail?: RemixNode;
	}

	/** One step of the run. */
	export interface Step {
		title: RemixNode;
		/** Quieter line under the title. */
		detail?: RemixNode;
		/** The step's source line, set in mono under the title in place of `detail`. */
		code?: string;
	}

	/**
	 * Props accepted by {@link FlowDiagram}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Accessible name of the run's list. Required — the library ships no copy. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		trigger: Trigger;
		/** The steps, in run order. */
		steps: readonly Step[];
		/** The result badge that appears once the last step passes, such as "Run passed". */
		outcome: RemixNode;
		/** A note across from the outcome, such as what happens on failure. */
		footnote?: RemixNode;
	}
}

/**
 * Renders the run as an ordered list on a raised surface inside a {@link MotionLoop}.
 * Without motion, or before the animation starts, every step shows as passed, so the
 * static picture is the finished run. Two diagrams with the same step count share keyframes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the diagram's markup.
 * @example
 * <FlowDiagram
 * 	aria-label="Sign-in check"
 * 	trigger={{ icon: <ClockIcon size={14} />, title: "Every 5 minutes" }}
 * 	steps={[{ title: "Sign in", code: 'http.post "/api/sessions"' }]}
 * 	outcome="Run passed"
 * />
 */
export function FlowDiagram(handle: Handle<FlowDiagram.Props>) {
	return () => {
		let {
			"aria-label": label,
			footnote,
			mix,
			outcome,
			pauseLabel,
			steps,
			trigger,
			...rest
		} = handle.props;
		let timing = timingFor(steps.length);

		return (
			<MotionLoop {...rest} pauseLabel={pauseLabel} placement="start-end" mix={mix}>
				<div
					data-slot="flow-diagram"
					mix={[
						marketingSurface(),
						raw({ display: "grid", gap: "1.5rem", padding: "clamp(1.25rem, 4cqi, 2rem)" }),
					]}
				>
					<ol
						aria-label={label}
						mix={[
							raw({
								position: "relative",
								display: "grid",
								gap: ROW_GAP,
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
								{trigger.icon}
							</span>
							{steps.length > 0 ? <Connector timing={timing} index={-1} /> : null}
							<RowText title={trigger.title} detail={trigger.detail} clearance />
						</li>
						{steps.map((step, index) => (
							<li key={index} mix={[stepRow()]}>
								<span mix={[dot(), stepDot(timing, index)]}>
									<CheckIcon
										size={14}
										strokeWidth={2.5}
										aria-hidden="true"
										mix={[stepCheck(timing, index)]}
									/>
								</span>
								{index < steps.length - 1 ? <Connector timing={timing} index={index} /> : null}
								<RowText title={step.title} detail={step.detail} code={step.code} />
							</li>
						))}
					</ol>

					<div
						data-slot="flow-diagram-footer"
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
						<span data-slot="flow-diagram-outcome" mix={[outcomeBadge(timing)]}>
							<CheckIcon size={14} strokeWidth={2.5} aria-hidden="true" />
							{outcome}
						</span>
						{footnote ? (
							<span
								mix={[
									detail(),
									raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" }),
								]}
							>
								{footnote}
							</span>
						) : null}
					</div>
				</div>
			</MotionLoop>
		);
	};
}

/** When each element of a run with a given number of steps lights, in percent of the cycle. */
interface Timing {
	/** Number of steps, which names the keyframes so equal runs share them. */
	count: number;
	gap: number;
}

/** Spreads `count` steps over {@link STEPS_SPAN}, never further apart than {@link MAX_STEP_GAP}. */
function timingFor(count: number): Timing {
	return { count, gap: count > 0 ? Math.min(MAX_STEP_GAP, STEPS_SPAN / count) : MAX_STEP_GAP };
}

/** Percent of the cycle at which step `index` passes. */
function passesAt(timing: Timing, index: number) {
	return FIRST_STEP_AT + index * timing.gap;
}

/** Props {@link RowText} reads. */
interface RowTextProps {
	title: RemixNode;
	detail?: RemixNode;
	code?: string;
	/** Keeps the row's text clear of the pause toggle in the surface's corner. */
	clearance?: boolean;
}

/** A row's caption over its quieter line, which is the step's code when it has some. */
function RowText(handle: Handle<RowTextProps>) {
	return () => {
		let { clearance, code, detail: line, title } = handle.props;
		return (
			<span
				mix={[
					raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" }),
					clearance ? raw({ paddingInlineEnd: PAUSE_CLEARANCE }) : [],
				]}
			>
				<span mix={[caption()]}>{title}</span>
				{code === undefined ? null : (
					<code mix={[detail(), raw({ fontFamily: "var(--ui-font-mono)" })]}>{code}</code>
				)}
				{code === undefined && line !== undefined ? <span mix={[detail()]}>{line}</span> : null}
			</span>
		);
	};
}

/** Props {@link Connector} reads. */
interface ConnectorProps {
	timing: Timing;
	/** The row the line leaves from: `-1` for the trigger, else the step's index. */
	index: number;
}

/**
 * The line from one row's dot to the next row's dot. It runs from under the dot to the
 * end of the row gap, where the next dot starts, so the line ends at the next dot however
 * tall a row's text wraps. Its fill grows as the run moves to the next step.
 */
function Connector(handle: Handle<ConnectorProps>) {
	return () => {
		let { index, timing } = handle.props;
		let name = `ui-flow-connector-${timing.count}-${index + 1}`;
		let from = index < 0 ? FIRST_STEP_AT - timing.gap / 2 : passesAt(timing, index);
		let to = passesAt(timing, index + 1);

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

/** The round status marker a row's state reads from. */
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
function stepDot(timing: Timing, index: number) {
	let name = `ui-flow-dot-${timing.count}-${index}`;
	let on = {
		backgroundColor: "var(--ui-success-bg-solid)",
		borderColor: "var(--ui-success-bg-solid)",
	};
	let off = { backgroundColor: "var(--ui-bg)", borderColor: "var(--ui-neutral-border)" };

	return [
		keyframes(name, litFrames(passesAt(timing, index), off, on)),
		raw({ ...on, color: "var(--ui-success-fg-on-solid)" }),
		motionSafe(raw(loop(name))),
	];
}

/** A step's check mark, shown once the step passes. */
function stepCheck(timing: Timing, index: number) {
	let name = `ui-flow-check-${timing.count}-${index}`;

	return [
		keyframes(name, litFrames(passesAt(timing, index), { opacity: "0" }, { opacity: "1" })),
		motionSafe(raw(loop(name))),
	];
}

/** The run's outcome, which appears after the last step passes. */
function outcomeBadge(timing: Timing) {
	let name = `ui-flow-outcome-${timing.count}`;

	return [
		keyframes(
			name,
			litFrames(
				passesAt(timing, timing.count),
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

/** A row's caption in the heading ink. */
function caption() {
	return raw({
		fontSize: "0.9375rem",
		lineHeight: "1.5rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}

/** The quieter line under a caption, and the footnote. */
function detail() {
	return raw({
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
