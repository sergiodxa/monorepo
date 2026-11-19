/**
 * The line under a conversation saying who is writing right now: three pulsing dots and
 * "Mira is typing…". It is a polite live region that keeps its height while empty, so the log
 * above never jumps as people start and stop typing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { hstack, inlineFlex } from "@sdxc/u/layout";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { fontSize, truncate } from "@sdxc/u/typography";
import { attrs } from "remix/component";

/** The keyframes each dot rises and fades through, offset per dot. */
const DOT_KEYFRAMES = "ui-typing-indicator-dot";

/** Prop types for {@link TypingIndicator}, and the sentences {@link typingLabel} picks from. */
export namespace TypingIndicator {
	/** Props accepted by {@link TypingIndicator}. */
	export interface Props extends TagProps<"div"> {
		/**
		 * What is said, such as `typingLabel(names, labels)`; empty while nobody types, which
		 * hides the dots and keeps the line's height.
		 */
		children?: RemixNode;
	}

	/** The sentences {@link typingLabel} picks from, so each locale words its own. */
	export interface Labels {
		one: (name: string) => string;
		two: (first: string, second: string) => string;
		many: (count: number) => string;
	}
}

/**
 * Renders the status line. While it has text the dots pulse in turn; under reduced motion
 * they hold still. Its `role="status"` announces each change once.
 *
 * @example <TypingIndicator>{typingLabel(["Mira"], labels)}</TypingIndicator>
 */
export function TypingIndicator(handle: Handle<TypingIndicator.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let empty = children === undefined || children === null || children === "";
		return (
			<div
				{...rest}
				data-slot="typing-indicator"
				data-empty={empty ? "" : undefined}
				mix={mergeMix(
					[
						attrs({ role: "status", "aria-live": "polite" }),
						hstack({ gap: 2, align: "center" }),
						fontSize("xs"),
						fg("neutral.muted"),
						raw({ minBlockSize: "1.25rem", minInlineSize: "0" }),
						when('&[data-empty] > [data-slot="typing-dots"]', raw({ visibility: "hidden" })),
					],
					mix,
				)}
			>
				<span
					data-slot="typing-dots"
					aria-hidden="true"
					mix={[
						keyframes(DOT_KEYFRAMES, {
							"0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.45" },
							"30%": { transform: "translateY(-0.1875rem)", opacity: "1" },
						}),
						inlineFlex(),
						raw({
							gap: "0.1875rem",
							"& > span": {
								inlineSize: "0.3125rem",
								blockSize: "0.3125rem",
								borderRadius: "999px",
								backgroundColor: "currentColor",
								animation: `${DOT_KEYFRAMES} 1.2s ease-in-out infinite`,
							},
							"& > span:nth-child(2)": { animationDelay: "0.15s" },
							"& > span:nth-child(3)": { animationDelay: "0.3s" },
						}),
						motionReduce(raw({ "& > span": { animation: "none", opacity: "0.7" } })),
					]}
				>
					<span />
					<span />
					<span />
				</span>
				<span data-slot="typing-text" mix={[truncate()]}>
					{children}
				</span>
			</div>
		);
	};
}

/**
 * Words who is typing: one name, two names, or a count once three or more type at once.
 *
 * @param names Who is typing, in the order they started.
 * @param labels The sentences for each case.
 * @returns The sentence, or `""` when nobody is typing.
 * @example typingLabel(["Mira"], labels) // "Mira is typing…"
 */
export function typingLabel(names: readonly string[], labels: TypingIndicator.Labels): string {
	let [first, second] = names;
	if (first === undefined) return "";
	if (second === undefined) return labels.one(first);
	if (names.length === 2) return labels.two(first, second);
	return labels.many(names.length);
}
