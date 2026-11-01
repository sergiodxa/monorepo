/**
 * An animated terminal that proves "you write this, it does that": a short spec or command
 * types itself out line by line, then its output prints, holds, and the loop restarts.
 * It wears the terminal panel's chrome, and its static markup is the finished session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

import { CodeStage } from "./code-stage.js";
import { PauseToggle, pausedWhenChecked } from "./utils/pause-toggle.js";

/** Time each typed character takes, so every terminal types at the same speed. */
const CHAR_MS = 35;

/** Time before the first line starts, so a loop opens on an empty prompt for a beat. */
const LEAD_MS = 400;

/** Pause between the end of an input line and the first output line after it. */
const AFTER_INPUT_MS = 350;

/** Pause between two output lines printing in turn. */
const BETWEEN_OUTPUTS_MS = 200;

/** Pause between the last output line and the next input line starting to type. */
const BEFORE_INPUT_MS = 500;

/** How long the finished session holds before the reset. */
const HOLD_MS = 2500;

/** Shortest loop, so a one-line command still holds long enough to read. */
const MIN_CYCLE_MS = 8000;

/** Longest loop; a long spec types faster rather than running past it. */
const MAX_CYCLE_MS = 12000;

/** Percent of the cycle at which every line clears again for the next loop. */
const RESET_AT = 95;

/** Percent of the cycle an output line takes to fade in. */
const FADE = 1.5;

/** Name of the caret's blink, shared by every terminal since it never depends on content. */
const BLINK = "ui-typed-terminal-blink";

/**
 * Prop types for {@link TypedTerminal}.
 */
export namespace TypedTerminal {
	/** Ink an output line prints in: a pass, a failure, or a quiet aside. */
	export type Status = "ok" | "fail" | "muted";

	/** One line of the session. */
	export interface Line {
		/** An `input` line types itself out; an `output` line fades in once typed lines finish. */
		kind: "input" | "output";
		/**
		 * The line's text, kept on one line and scrolled sideways when it outgrows the panel.
		 * An input line types one mono column per UTF-16 unit, so keep it to single-width text.
		 */
		text: string;
		/** Ink of an output line; input lines ignore it. */
		status?: Status;
	}

	/**
	 * Props accepted by {@link TypedTerminal}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children" | "title"> {
		/** Accessible name of the session's figure. Required — the library ships no copy. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		/** Window title, such as a file name or a shell. */
		title?: RemixNode;
		/** Glyph before every input line, such as `$`; omit it for editor-style lines. */
		prompt?: string;
		/** The session, in the order it plays. */
		lines: readonly Line[];
	}
}

/**
 * Renders the session as one `<pre>` in the terminal panel, with its pause toggle in the
 * panel's title bar, centred against the title.
 * Every line's full text is in the markup from the start, clipped only visually while it
 * types, so screen readers and copy read the whole session and reduced motion shows it done.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the terminal's markup.
 * @example
 * <TypedTerminal
 * 	aria-label="A sign-in spec and its run"
 * 	title="sign-in.spec"
 * 	lines={[
 * 		{ kind: "input", text: 'visit "/login"' },
 * 		{ kind: "output", text: "✓ 1 step · 0.4s", status: "ok" },
 * 	]}
 * />
 */
export function TypedTerminal(handle: Handle<TypedTerminal.Props>) {
	return () => {
		let { "aria-label": label, lines, mix, pauseLabel, prompt, title, ...rest } = handle.props;
		let schedule = scheduleFor(lines);
		let nodes: RemixNode[] = [];
		for (let [index, line] of lines.entries()) {
			if (index > 0) nodes.push("\n");
			let slot = schedule.slots[index]!;
			nodes.push(
				line.kind === "input" ? (
					<InputLine text={line.text} prompt={prompt} slot={slot} schedule={schedule} />
				) : (
					<OutputLine text={line.text} status={line.status} slot={slot} schedule={schedule} />
				),
			);
		}

		return (
			<div
				{...rest}
				data-slot="motion-loop"
				mix={mergeMix([pausedWhenChecked('[data-slot="typed-terminal"]')], mix)}
			>
				<figure
					aria-label={label}
					data-slot="typed-terminal"
					mix={[raw({ margin: "0", minInlineSize: "0" })]}
				>
					<CodeStage
						variant="terminal"
						title={title}
						actions={
							<PauseToggle label={pauseLabel ?? "Pause the animation"} mix={[headerToggle()]} />
						}
					>
						{nodes}
					</CodeStage>
				</figure>
			</div>
		);
	};
}

/** When one line plays, in percent of the cycle. */
interface Slot {
	/** Line position, which names the line's keyframes. */
	index: number;
	/** Characters an input line types; `0` for output lines. */
	chars: number;
	/** Percent at which the line starts typing or fading in. */
	from: number;
	/** Percent at which an input line finishes typing. */
	to: number;
	/** Percent at which the next line starts, where this line's caret leaves. */
	until: number;
}

/** The whole session's timing: one loop's length and every line's slot in it. */
interface Schedule {
	/** Number of lines, which names the keyframes so sessions of different sizes never share. */
	count: number;
	cycleMs: number;
	slots: Slot[];
}

/**
 * Lays the lines on one loop: inputs type at {@link CHAR_MS} a character, faster only when
 * the session would otherwise run past {@link MAX_CYCLE_MS}; outputs print after the input
 * before them; the loop then holds for {@link HOLD_MS} and resets.
 */
function scheduleFor(lines: readonly TypedTerminal.Line[]): Schedule {
	let lengths = lines.map((line) => (line.kind === "input" ? line.text.length : 0));
	let gaps = lines.map((line, index) => gapBefore(line, lines[index - 1]));
	let fixed = LEAD_MS + gaps.reduce((sum, gap) => sum + gap, 0);
	let chars = lengths.reduce((sum, length) => sum + length, 0);
	let budget = (MAX_CYCLE_MS * RESET_AT) / 100 - HOLD_MS - fixed;
	let charMs = chars > 0 ? Math.max(1, Math.min(CHAR_MS, budget / chars)) : CHAR_MS;
	let active = fixed + chars * charMs;
	let cycleMs = Math.min(
		MAX_CYCLE_MS,
		Math.max(MIN_CYCLE_MS, ((active + HOLD_MS) * 100) / RESET_AT),
	);
	let percent = (ms: number) => Math.round((ms / cycleMs) * 10000) / 100;

	let at = LEAD_MS;
	let spans = lines.map((_, index) => {
		at += index > 0 ? gaps[index]! : 0;
		let start = at;
		at += lengths[index]! * charMs;
		return { start, end: at };
	});
	let slots = spans.map((span, index) => ({
		index,
		chars: lengths[index]!,
		from: percent(span.start),
		to: percent(span.end),
		until: index + 1 < spans.length ? percent(spans[index + 1]!.start) : RESET_AT,
	}));
	return { count: lines.length, cycleMs, slots };
}

/** The pause before `line`, which depends on whether it follows an input or an output line. */
function gapBefore(line: TypedTerminal.Line, previous: TypedTerminal.Line | undefined): number {
	if (previous === undefined) return 0;
	if (line.kind === "input") return previous.kind === "output" ? BEFORE_INPUT_MS : 0;
	return previous.kind === "input" ? AFTER_INPUT_MS : BETWEEN_OUTPUTS_MS;
}

/**
 * A keyframe name for one part of one line, unique to its stops: two terminals with the
 * same shape share it, and any difference in line count, position or timing names another.
 */
function frameName(part: string, schedule: Schedule, slot: Slot) {
	let stops = [slot.from, slot.to, slot.until].map((stop) => Math.round(stop * 100)).join("-");
	return `ui-typed-terminal-${part}-${schedule.count}-${slot.index}-${stops}`;
}

/** The animation declarations a line's part shares: one loop of the session's cycle. */
function loop(name: string, schedule: Schedule, timing: string) {
	return {
		animationName: name,
		animationDuration: `${schedule.cycleMs}ms`,
		animationTimingFunction: timing,
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/** Props {@link InputLine} reads. */
interface InputLineProps {
	text: string;
	prompt?: string;
	slot: Slot;
	schedule: Schedule;
}

/**
 * A line that types itself out: the prompt, shown once the line is reached, the text
 * revealed one character width at a time, and a caret that shows and blinks only while
 * this line is the one being typed.
 */
function InputLine(handle: Handle<InputLineProps>) {
	return () => {
		let { prompt, schedule, slot, text } = handle.props;
		let typing = frameName("type", schedule, slot);
		let caret = frameName("caret", schedule, slot);
		let reached = frameName("prompt", schedule, slot);

		return (
			<span data-line="" data-kind="input">
				{prompt === undefined ? null : (
					<span
						aria-hidden="true"
						mix={[
							keyframes(reached, {
								"0%": { visibility: "hidden" },
								[`${slot.from}%`]: { visibility: "visible" },
								[`${RESET_AT + 2}%`]: { visibility: "hidden" },
								"100%": { visibility: "hidden" },
							}),
							raw({
								color: "color-mix(in oklab, currentColor 60%, transparent)",
								userSelect: "none",
							}),
							motionSafe(raw(loop(reached, schedule, "step-end"))),
						]}
					>
						{`${prompt} `}
					</span>
				)}
				<span
					data-slot="typed-terminal-text"
					mix={[
						keyframes(typing, {
							"0%": { inlineSize: "0" },
							[`${slot.from}%`]: { inlineSize: "0" },
							[`${slot.to}%`]: { inlineSize: "calc(var(--chars) * 1ch)" },
							[`${RESET_AT}%`]: { inlineSize: "calc(var(--chars) * 1ch)" },
							[`${RESET_AT + 2}%`]: { inlineSize: "0" },
							"100%": { inlineSize: "0" },
						}),
						raw({
							"--chars": String(slot.chars),
							display: "inline-block",
							verticalAlign: "top",
							overflow: "hidden",
							whiteSpace: "pre",
						}),
						motionSafe(raw(loop(typing, schedule, "steps(var(--chars), end)"))),
					]}
				>
					{text}
				</span>
				<span
					aria-hidden="true"
					data-slot="typed-terminal-caret"
					mix={[
						keyframes(caret, {
							"0%": { visibility: "hidden" },
							[`${slot.from}%`]: { visibility: "visible" },
							[`${slot.until}%`]: { visibility: "hidden" },
							"100%": { visibility: "hidden" },
						}),
						keyframes(BLINK, { "0%": { opacity: "1" }, "50%": { opacity: "0" } }),
						raw({
							display: "inline-block",
							verticalAlign: "text-bottom",
							inlineSize: "1ch",
							blockSize: "1.2em",
							backgroundColor: "color-mix(in oklab, currentColor 75%, transparent)",
							visibility: "hidden",
						}),
						motionSafe(
							raw({
								animationName: `${caret}, ${BLINK}`,
								animationDuration: `${schedule.cycleMs}ms, 1s`,
								animationTimingFunction: "step-end",
								animationIterationCount: "infinite",
								animationFillMode: "both",
							}),
						),
					]}
				/>
			</span>
		);
	};
}

/** Props {@link OutputLine} reads. */
interface OutputLineProps {
	text: string;
	status?: TypedTerminal.Status;
	slot: Slot;
	schedule: Schedule;
}

/** A line the session prints: it fades in at its slot in the status's ink. */
function OutputLine(handle: Handle<OutputLineProps>) {
	return () => {
		let { schedule, slot, status, text } = handle.props;
		let name = frameName("output", schedule, slot);

		return (
			<span
				data-line=""
				data-kind="output"
				data-status={status}
				mix={[
					keyframes(name, {
						"0%": { opacity: "0" },
						[`${slot.from}%`]: { opacity: "0" },
						[`${slot.from + FADE}%`]: { opacity: "1" },
						[`${RESET_AT}%`]: { opacity: "1" },
						[`${RESET_AT + 2}%`]: { opacity: "0" },
						"100%": { opacity: "0" },
					}),
					raw({ color: statusInk(status) }),
					motionSafe(raw(loop(name, schedule, "linear"))),
				]}
			>
				{text}
			</span>
		);
	};
}

/**
 * The ink for an output status. The terminal panel inverts the page's scheme, so a pass
 * or failure takes the palette step that reads on the panel rather than on the page.
 */
function statusInk(status: TypedTerminal.Status | undefined) {
	if (status === "ok") {
		return "light-dark(var(--ui-color-success-400), var(--ui-color-success-700))";
	}
	if (status === "fail") {
		return "light-dark(var(--ui-color-danger-400), var(--ui-color-danger-700))";
	}
	if (status === "muted") return "color-mix(in oklab, currentColor 65%, transparent)";
	return "inherit";
}

/**
 * The pause toggle as title-bar chrome: small enough to leave the bar its breathing room,
 * ringed and inked in the panel's own colour, and inset from the end as far as the title
 * is from the start.
 */
function headerToggle() {
	return raw({
		inlineSize: "1.5rem",
		blockSize: "1.5rem",
		marginInlineEnd: "0.5rem",
		backgroundColor: "transparent",
		boxShadow: "inset 0 0 0 1px color-mix(in oklab, currentColor 28%, transparent)",
		color: "inherit",
		opacity: "0.75",
	});
}
