/**
 * What an assistant did before it answered: a collapsible "Thinking" disclosure holding its
 * narration and a list of steps (searched, read, ran a command), each able to open onto its
 * own output. Native `<details>` throughout, so it opens and closes without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, ChevronRightIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { listStyle, mergeMix, raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { open, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { text } from "@sdxc/u/typography";

/** The attribute a reply carries while its text streams in, which turns the summary live. */
const BUSY_SELECTOR = ':where([aria-busy="true"])';

/** The activity once a replay folded it, whose summary says what was done again. */
const COLLAPSED_SELECTOR = ":where([data-stream-collapsed])";

/** Text a streaming replay leaves whole, so the summary never types itself out. */
const STREAM_SKIP = { "data-stream-skip": "" };

/** Keyframes for the busy label's light sweep. */
const SHIMMER = "ui-activity-shimmer";

/** Keyframes for the running step's dots. */
const DOTS = "ui-activity-dots";

/** Prop types for {@link Activity} and its compound parts. */
export namespace Activity {
	/** Props accepted by {@link Activity}: every native `<details>` attribute. */
	export interface Props extends TagProps<"details"> {
		/** An {@link Activity.Summary}, then an optional {@link Activity.Note} and {@link Activity.Steps}. */
		children: RemixNode;
	}

	/** Props accepted by {@link Activity.Summary}. */
	export interface SummaryProps extends TagProps<"summary"> {
		/** What the summary says once the work is done, such as "Thought for 8s". */
		children: RemixNode;
		/**
		 * What it says while the reply around it is busy (`aria-busy="true"`), such as
		 * "Thinking"; it shimmers until the reply settles.
		 */
		busy?: RemixNode;
	}

	/** Props accepted by {@link Activity.Note}. */
	export interface NoteProps extends TagProps<"p"> {
		/** The assistant's own words on what it is about to do. */
		children: RemixNode;
	}

	/** Props accepted by {@link Activity.Steps}. */
	export interface StepsProps extends TagProps<"ol"> {
		/** {@link Activity.Step} rows in the order they happened. */
		children: RemixNode;
		/** Frames the list with dividers, for a run of similar steps inside another step. */
		boxed?: boolean;
	}

	/** Props accepted by {@link Activity.Step}. */
	export interface StepProps extends Omit<TagProps<"li">, "title"> {
		/** What happened, in the past tense ("Searched the web"), or the present while `running`. */
		children: RemixNode;
		/** A 16px glyph for the kind of step; a step that only marks progress goes without. */
		icon?: RemixNode;
		/** What the step opens onto: a command's output, or a {@link Activity.Steps} `boxed` run. */
		detail?: RemixNode;
		/** Draws the step as still in progress, with moving dots in place of its icon. */
		running?: boolean;
		/**
		 * How long a streamed replay dwells on this step, in milliseconds, so a search or a command
		 * reads as taking time; while it dwells the step shows the moving dots.
		 */
		duration?: number;
	}
}

/**
 * Renders the disclosure. Pass `open` while the reply streams so its steps show as they
 * arrive; a replay folds it once the answer starts, and history leaves it closed.
 *
 * @example
 * <Activity open>
 * 	<Activity.Summary busy="Thinking">Thought for 8s</Activity.Summary>
 * 	<Activity.Steps><Activity.Step icon={<GlobeIcon />}>Searched the web</Activity.Step></Activity.Steps>
 * </Activity>
 */
export function Activity(handle: Handle<Activity.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<details
				{...rest}
				data-slot="activity"
				data-stream-collapse=""
				mix={mergeMix(
					[
						raw({ display: "block", marginBlockEnd: "1rem" }),
						open(when("& > summary > svg", rotate(180))),
						open(when("& > summary", raw({ marginBlockEnd: "0.625rem" }))),
					],
					mix,
				)}
			>
				{children}
			</details>
		);
	};
}

/** The disclosure's line: the done label, or the shimmering busy one while the reply streams. */
Activity.Summary = function ActivitySummary(handle: Handle<Activity.SummaryProps>) {
	return () => {
		let { busy, children, mix, ...rest } = handle.props;
		return (
			<summary
				{...rest}
				{...STREAM_SKIP}
				data-slot="activity-summary"
				mix={mergeMix(
					[
						keyframes(SHIMMER, {
							"0%": { backgroundPosition: "100% 0" },
							"100%": { backgroundPosition: "-100% 0" },
						}),
						text("sm"),
						fg("neutral.fg-muted"),
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							inlineSize: "fit-content",
							cursor: "pointer",
							listStyle: "none",
							"&::-webkit-details-marker": { display: "none" },
							"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "2px",
								borderRadius: "var(--ui-radius-sm, 0.25rem)",
							},
							"& [data-activity-label=busy]": { display: "none" },
							[`${BUSY_SELECTOR} & [data-activity-label=busy]`]: { display: "inline" },
							[`${BUSY_SELECTOR} & [data-activity-label=done]`]: { display: "none" },
							[`${COLLAPSED_SELECTOR} & [data-activity-label=busy]`]: { display: "none" },
							[`${COLLAPSED_SELECTOR} & [data-activity-label=done]`]: { display: "inline" },
						}),
						media(
							"(prefers-reduced-motion: no-preference)",
							raw({
								[`${BUSY_SELECTOR} & [data-activity-label=busy]`]: {
									backgroundImage:
										"linear-gradient(90deg, var(--ui-neutral-fg-muted) 35%, var(--ui-neutral-fg-emphasis) 50%, var(--ui-neutral-fg-muted) 65%)",
									backgroundSize: "200% 100%",
									backgroundClip: "text",
									WebkitBackgroundClip: "text",
									color: "transparent",
									animationName: SHIMMER,
									animationDuration: "1.6s",
									animationTimingFunction: "linear",
									animationIterationCount: "infinite",
								},
							}),
						),
					],
					mix,
				)}
			>
				{busy === undefined ? null : <span data-activity-label="busy">{busy}</span>}
				<span data-activity-label="done">{children}</span>
				<ChevronDownIcon size={14} aria-hidden="true" />
			</summary>
		);
	};
};

/** The assistant's narration, set as body text above its steps. */
Activity.Note = function ActivityNote(handle: Handle<Activity.NoteProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<p
				{...rest}
				data-slot="activity-note"
				mix={mergeMix(
					[raw({ margin: "0 0 0.75rem", lineHeight: "1.6" }), fg("neutral.fg-emphasis")],
					mix,
				)}
			>
				{children}
			</p>
		);
	};
};

/** The steps, in order; `boxed` frames a run of them with dividers. */
Activity.Steps = function ActivitySteps(handle: Handle<Activity.StepsProps>) {
	return () => {
		let { boxed = false, children, mix, ...rest } = handle.props;
		return (
			<ol
				{...rest}
				data-slot="activity-steps"
				data-boxed={boxed ? "" : undefined}
				mix={mergeMix(
					[
						m(0),
						p(0),
						listStyle(),
						raw({
							display: "grid",
							gap: "0.5rem",
							"&[data-boxed]": {
								gap: "0",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg, 0.75rem)",
								overflow: "hidden",
							},
							"&[data-boxed] > li": { paddingBlock: "0.5rem", paddingInline: "0.875rem" },
							"&[data-boxed] > li + li": { borderBlockStart: "1px solid var(--ui-neutral-border)" },
						}),
					],
					mix,
				)}
			>
				{children}
			</ol>
		);
	};
};

/** The four dots a running step shows in place of its icon. */
function RunningDots() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				keyframes(DOTS, {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.25" },
				}),
				raw({
					display: "inline-grid",
					gridTemplateColumns: "repeat(2, 4px)",
					gap: "3px",
					inlineSize: "16px",
					placeContent: "center",
					"& > i": {
						inlineSize: "4px",
						blockSize: "4px",
						borderRadius: "999px",
						backgroundColor: "var(--ui-brand-fg)",
					},
				}),
				media(
					"(prefers-reduced-motion: no-preference)",
					raw({
						"& > i": {
							animationName: DOTS,
							animationDuration: "1.2s",
							animationIterationCount: "infinite",
						},
						"& > i:nth-child(2)": { animationDelay: "0.3s" },
						"& > i:nth-child(4)": { animationDelay: "0.6s" },
						"& > i:nth-child(3)": { animationDelay: "0.9s" },
					}),
				),
			]}
		>
			<i />
			<i />
			<i />
			<i />
		</span>
	);
}

/**
 * One step: its glyph and words in a muted line. With `detail` the line is a nested
 * disclosure that opens onto the step's output.
 */
Activity.Step = function ActivityStep(handle: Handle<Activity.StepProps>) {
	return () => {
		let { children, detail, duration, icon, running = false, mix, ...rest } = handle.props;
		let line = (
			<>
				<span data-slot="activity-dots" mix={[raw({ flexShrink: 0 })]}>
					<RunningDots />
				</span>
				{icon === undefined ? null : (
					<span data-slot="activity-icon" mix={[raw({ flexShrink: 0 })]}>
						{icon}
					</span>
				)}
				<span mix={[raw({ minInlineSize: 0 })]}>{children}</span>
			</>
		);
		let lineMix = raw({ display: "flex", alignItems: "center", gap: "0.5rem" });

		return (
			<li
				{...rest}
				data-slot="activity-step"
				data-running={running ? "" : undefined}
				data-stream-pause={duration}
				mix={mergeMix(
					[
						text("sm"),
						fg("neutral.fg-muted"),
						raw({
							"& [data-slot=activity-icon]": { display: "inline-flex" },
							"& [data-slot=activity-dots]": { display: "none" },
							"&[data-running] [data-slot=activity-dots]": { display: "inline-flex" },
							"&[data-running] [data-slot=activity-icon]": { display: "none" },
							[`${BUSY_SELECTOR} &:is([data-stream-current], :has([data-stream-current])) [data-slot=activity-dots]`]:
								{ display: "inline-flex" },
							[`${BUSY_SELECTOR} &:is([data-stream-current], :has([data-stream-current])) [data-slot=activity-icon]`]:
								{ display: "none" },
						}),
					],
					mix,
				)}
			>
				{detail === undefined ? (
					<div mix={[lineMix]}>{line}</div>
				) : (
					<details
						mix={[
							raw({ "& > :not(summary)": { marginBlockStart: "0.5rem" } }),
							open(when("& > summary > svg", rotate(90))),
						]}
					>
						<summary
							mix={[
								lineMix,
								raw({
									cursor: "pointer",
									listStyle: "none",
									inlineSize: "fit-content",
									"&::-webkit-details-marker": { display: "none" },
									"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
								}),
							]}
						>
							{line}
							<ChevronRightIcon size={14} aria-hidden="true" />
						</summary>
						{detail}
					</details>
				)}
			</li>
		);
	};
};
