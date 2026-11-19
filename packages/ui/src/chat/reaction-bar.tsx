/**
 * The row of emoji reactions under a message: each a chip with its emoji and count, pressed
 * when the reader is among those who reacted, a slot for adding one, and a template for chips
 * added in place. Chips are submit buttons, so a reaction posts before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
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
		/**
		 * One form per {@link ReactionBar.Reaction}, then an optional {@link ReactionBar.Add}
		 * and {@link ReactionBar.Template}. The row hides while it holds no reaction.
		 */
		children: RemixNode;
	}

	/** The field a chip submits: its name, and the value that adds or removes the reaction. */
	export interface Toggle {
		name: string;
		on: string;
		off: string;
	}

	/** Props accepted by {@link ReactionBar.Reaction}. */
	export interface ReactionProps extends Omit<
		TagProps<"button">,
		"children" | "aria-label" | "name" | "value"
	> {
		/** The emoji, or the shortcode of a custom one drawn from `image`. */
		emoji: string;
		/** A custom emoji's image, drawn in place of the emoji's text. */
		image?: string;
		/** What the emoji is called, such as "Party popper"; a screen reader hears it before the count. */
		label: string;
		count: number;
		/** Whether the reader reacted with this emoji; the chip draws pressed. */
		pressed?: boolean;
		/** @default { name: "on", on: "1", off: "0" } */
		toggle?: Toggle;
	}

	/** Props accepted by {@link ReactionBar.Add}. */
	export interface AddProps extends TagProps<"span"> {
		/** The add-reaction control, such as a button opening an emoji picker. */
		children: RemixNode;
	}

	/** Props accepted by {@link ReactionBar.Template}. */
	export interface TemplateProps {
		/**
		 * The form a new reaction posts with, holding an `<input data-reaction-emoji>` for its
		 * emoji and one {@link ReactionBar.Reaction}; `reactionSync()` clones and fills it.
		 */
		children: RemixNode;
	}
}

/** The field a chip submits when the caller names none. */
const DEFAULT_TOGGLE: ReactionBar.Toggle = { name: "on", on: "1", off: "0" };

/**
 * Renders the row as a `role="group"` that wraps onto a second line when a message collects
 * many reactions, and hides itself while it holds no chip.
 *
 * @example
 * <ReactionBar aria-label="Reactions">
 * 	<form method="post" action="/messages/42/react"><input type="hidden" name="emoji" value="🎉" /><ReactionBar.Reaction emoji="🎉" label="Party popper" count={3} pressed /></form>
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
						when("&:not(:has([data-slot=reaction]:not(template *)))", raw({ display: "none" })),
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
 * Renders one reaction chip: a submit button sending the toggle that flips the reader's
 * reaction, `aria-pressed` while they are among its reactors, and its count in tabular figures
 * so the row never shifts. Its accessible name is the emoji's label and the count.
 */
ReactionBar.Reaction = function ReactionBarReaction(handle: Handle<ReactionBar.ReactionProps>) {
	return () => {
		let {
			emoji,
			image,
			label,
			count,
			pressed = false,
			toggle = DEFAULT_TOGGLE,
			mix,
			type = "submit",
			...rest
		} = handle.props;
		return (
			<button
				{...rest}
				type={type}
				name={toggle.name}
				value={pressed ? toggle.off : toggle.on}
				aria-pressed={pressed ? "true" : "false"}
				data-slot="reaction"
				data-emoji={emoji}
				data-toggle-on={toggle.on}
				data-toggle-off={toggle.off}
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
							"& > [data-reaction-emoji-glyph]": {
								display: "inline-grid",
								placeItems: "center",
								fontSize: "0.9375rem",
							},
							"& > [data-reaction-emoji-glyph] > img": {
								inlineSize: "1.0625rem",
								blockSize: "1.0625rem",
								objectFit: "contain",
							},
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
				<span data-reaction-emoji-glyph="" aria-hidden="true">
					{image === undefined ? emoji : <img src={image} alt="" draggable="false" />}
				</span>
				<span data-reaction-label="" mix={[visuallyHidden()]}>
					{label}
				</span>
				<span data-reaction-count="">{count}</span>
			</button>
		);
	};
};

/**
 * Renders the trailing slot for adding a reaction, where an emoji picker's trigger sits. Its
 * controls are pill-sized to match the chips beside them.
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
							"& :is(button, a)": {
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

/**
 * Renders the inert `<template>` a new chip is cloned from, so a reaction picked from an emoji
 * picker appears in the row at once, posting through the same form a server-drawn chip uses.
 */
ReactionBar.Template = function ReactionBarTemplate(handle: Handle<ReactionBar.TemplateProps>) {
	return () => <template data-reaction-template="">{handle.props.children}</template>;
};
