/**
 * The row of emoji reactions under a message: each a chip with its emoji and count, pressed
 * when the reader is among those who reacted, and a slot at the end for adding one. Chips are
 * submit buttons, so a reaction posts as a plain form before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { hstack, inlineFlex } from "@sdxc/u/layout";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { tabularNums } from "@sdxc/u/typography";
import { attrs } from "remix/component";

/** Prop types for {@link ReactionBar} and its compound parts. */
export namespace ReactionBar {
	/** Props accepted by {@link ReactionBar}. */
	export interface Props extends Omit<TagProps<"div">, "aria-label"> {
		/** Names the row for assistive technology, such as "Reactions". */
		"aria-label": string;
		/** {@link ReactionBar.Reaction} chips, then an optional {@link ReactionBar.Add}. */
		children: RemixNode;
	}

	/** Props accepted by {@link ReactionBar.Reaction}. */
	export interface ReactionProps extends Omit<TagProps<"button">, "children" | "aria-label"> {
		emoji: string;
		count: number;
		/** Whether the reader reacted with this emoji; the chip draws pressed. */
		pressed?: boolean;
		/** The full name a screen reader hears, such as "Party popper, 3 reactions, including you". */
		"aria-label": string;
	}

	/** Props accepted by {@link ReactionBar.Add}. */
	export interface AddProps extends TagProps<"span"> {
		/** The add-reaction control, such as an emoji picker in submit mode. */
		children: RemixNode;
	}
}

/**
 * Renders the row as a `role="group"` that wraps onto a second line when a message collects
 * many reactions.
 *
 * @example
 * <ReactionBar aria-label="Reactions">
 * 	<form method="post" action="/react"><ReactionBar.Reaction name="emoji" value="🎉" emoji="🎉" count={3} pressed aria-label="Party popper, 3, including you" /></form>
 * 	<ReactionBar.Add><EmojiPicker id="add-1" name="emoji" labels={…} /></ReactionBar.Add>
 * </ReactionBar>
 */
export function ReactionBar(handle: Handle<ReactionBar.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="reaction-bar"
				mix={mergeMix(
					[
						attrs({ role: "group" }),
						hstack({ gap: 1, align: "center" }),
						raw({ flexWrap: "wrap", "& > form": { display: "contents" } }),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders one reaction chip: a submit button by default, `aria-pressed` while the reader is
 * among its reactors, and its count in tabular figures so the row never shifts as it changes.
 */
ReactionBar.Reaction = function ReactionBarReaction(handle: Handle<ReactionBar.ReactionProps>) {
	return () => {
		let { emoji, count, pressed = false, mix, type = "submit", ...rest } = handle.props;
		return (
			<button
				{...rest}
				type={type}
				aria-pressed={pressed ? "true" : "false"}
				data-slot="reaction"
				mix={mergeMix(
					[
						inlineFlex(),
						rounded("full"),
						raw({
							alignItems: "center",
							gap: "0.3125rem",
							blockSize: "1.625rem",
							paddingInline: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-neutral-fg)",
							font: "inherit",
							fontSize: "0.75rem",
							fontWeight: "600",
							lineHeight: "1",
							cursor: "pointer",
							transition: "background-color 120ms, border-color 120ms",
							"& > [data-emoji]": { fontSize: "0.9375rem" },
						}),
						tabularNums(),
						when(
							"&:hover",
							raw({
								borderColor: "var(--ui-neutral-border-strong)",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							}),
						),
						when(
							"&[aria-pressed='true']",
							raw({
								borderColor: "var(--ui-brand-border-strong)",
								backgroundColor: "var(--ui-brand-bg-tint)",
								color: "var(--ui-brand-fg-emphasis)",
							}),
						),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				<span data-emoji="" aria-hidden="true">
					{emoji}
				</span>
				<span aria-hidden="true">{count}</span>
			</button>
		);
	};
};

/**
 * Renders the trailing slot for adding a reaction, faded until the row or its message is
 * hovered or focused, so a quiet message keeps a quiet row.
 */
ReactionBar.Add = function ReactionBarAdd(handle: Handle<ReactionBar.AddProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="reaction-add"
				mix={mergeMix(
					[
						inlineFlex(),
						raw({
							"& button": {
								blockSize: "1.625rem",
								minInlineSize: "1.625rem",
								borderRadius: "999px",
							},
						}),
					],
					mix,
				)}
			>
				{children}
			</span>
		);
	};
};
