/**
 * A bordered panel for searching and choosing among a list of actions:
 * {@link Command.Input} holds the query row, {@link Command.List} scrolls
 * through {@link Command.Item} rows, and {@link Command.Empty} holds a
 * message for when nothing matches. Its baseline rendering is a plain, fully
 * visible list of options, styled and ready to compose; the as-you-type
 * filtering and match highlighting a search experience needs arrive through
 * a separate opt-in behavior a consumer attaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, borderEdge, fg, outline, outlineStyle } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, maxBs, p, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, textAlign } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { floatingSurface } from "../styles/floating-surface";
import { interactiveTransition } from "../styles/interactive-transition";

/** `role="listbox"` applied to {@link Command.List} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_LIST_ROLE = "listbox";

/** `role="option"` applied to {@link Command.Item} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_ITEM_ROLE = "option";

/**
 * Prop types for {@link Command} and its compound parts.
 */
export namespace Command {
	/**
	 * Props accepted by {@link Command}.
	 */
	export interface Props extends TagProps<"div"> {
		/** The panel's compound parts: {@link Command.Input}, {@link Command.List}, {@link Command.Empty}. */
		children: RemixNode;
	}

	/**
	 * Every native `<input>` attribute, unchanged, plus the `mix` passthrough,
	 * styling the control itself — a type alias, since the native input prop
	 * type resolves through a conditional type only a type alias can express.
	 */
	export type InputProps = TagProps<"input">;

	/**
	 * Props accepted by {@link Command.List}.
	 */
	export interface ListProps extends TagProps<"div"> {
		/** The {@link Command.Item} rows (and, once nothing matches, {@link Command.Empty}) to scroll through. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Command.Item}.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/**
		 * Plain-text value identifying this row's content. A paired filter
		 * behavior matches typed text against this value directly, so it stays
		 * required even when the visible content is already plain text.
		 */
		value: string;
		/** The row's visible content: a label, and optionally a leading icon or trailing hint. */
		children?: RemixNode;
	}

	/**
	 * Props accepted by {@link Command.Empty}.
	 */
	export interface EmptyProps extends TagProps<"div"> {}
}

/**
 * Renders the panel's root host: a bordered, rounded, elevated `<div>`
 * stacking its compound parts in a column, clipping {@link Command.List}'s
 * scrolled content to the panel's own rounded corners.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Command aria-label={t("command.label")}>
 * 	<Command.Input aria-label={t("command.label")} placeholder={t("command.placeholder")} />
 * 	<Command.List>
 * 		<Command.Item value="new-file">{t("command.newFile")}</Command.Item>
 * 		<Command.Item value="new-folder">{t("command.newFolder")}</Command.Item>
 * 	</Command.List>
 * 	<Command.Empty>{t("command.empty")}</Command.Empty>
 * </Command>
 */
export function Command(handle: Handle<Command.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="command"
				mix={[floatingSurface(), vstack(), overflow("hidden"), fg("neutral.emphasis"), mix]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders the panel's query row: a `<div>` bordered along its block-end
 * edge wrapping a native `<input>` sized to the row's full padding and
 * height, marked `data-command-input` for a paired filter mixin to read.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the query row's markup.
 * @example
 * <Command.Input aria-label={t("command.label")} placeholder={t("command.placeholder")} />
 * @example
 * <Command.Input aria-label={t("command.label")} value={query} disabled />
 */
Command.Input = function CommandInput(handle: Handle<Command.InputProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div data-slot="input-wrapper" mix={borderEdge("block-end", { color: "neutral", width: 1 })}>
				<input
					{...rest}
					data-slot="input"
					data-command-input
					mix={[
						is("full"),
						bs("3.5rem"),
						pi(3),
						fg("neutral.emphasis"),
						when("&::placeholder", fg("neutral.muted")),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						when("&:disabled", [cursor("not-allowed"), opacity(50)]),
						bg("transparent"),
						text("sm"),
						outlineStyle("none"),
						mix,
					]}
				/>
			</div>
		);
	};
};

/**
 * Renders the panel's scrollable option region: a `<div>` carrying the
 * `listbox` role, capped at a fixed block size, its small inline padding
 * leaving room for a selected {@link Command.Item}'s own rounded corners.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the option region's markup.
 * @example
 * <Command.List>
 * 	<Command.Item value="new-file">{t("command.newFile")}</Command.Item>
 * 	<Command.Item value="new-folder">{t("command.newFolder")}</Command.Item>
 * </Command.List>
 */
Command.List = function CommandList(handle: Handle<Command.ListProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="list"
				mix={[
					attrs({ role: DEFAULT_LIST_ROLE }),
					maxBs("18rem"),
					overflow("auto"),
					p(2, 1),
					outlineStyle("none"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single row: a `<div>` carrying the `option` role, its `value`
 * mirrored onto `data-value` for a paired filter behavior to read. Nest a
 * `<button>` or `<a>` in `children` for native activation.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Command.Item value="new-file">{t("command.newFile")}</Command.Item>
 * @example
 * <Command.Item value="archived-project" aria-disabled="true">
 * 	{t("command.archivedProject")}
 * </Command.Item>
 */
Command.Item = function CommandItem(handle: Handle<Command.ItemProps>) {
	return () => {
		let { value, children, mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !value) {
			console.warn(
				'Command.Item: needs a "value" — a filter behavior matches typed text against this instead of parsing rendered children.',
			);
		}

		return (
			<div
				{...rest}
				data-slot="item"
				data-value={value}
				mix={[
					interactiveTransition(),
					attrs({ role: DEFAULT_ITEM_ROLE }),
					hstack({ gap: 2, align: "center" }),
					cursor("default"),
					rounded("md"),
					pi(2),
					pb(2),
					fg("neutral.emphasis"),
					when("&:hover", bg("neutral.bg-tint-hover")),
					when("&:active", bg("neutral.bg-tint-pressed")),
					when("&:focus", bg("brand.tint")),
					when('&[aria-selected="true"]', [bg("brand.solid"), fg("brand.onSolid")]),
					when('&[aria-disabled="true"]', opacity(50)),
					text("sm"),
					outlineStyle("none"),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the panel's no-match message: a centered, muted passage of small
 * text filling {@link Command.List}'s content area, carrying a
 * `data-command-empty` marker a paired filter behavior reads to toggle it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the message's markup.
 * @example
 * <Command.Empty>{t("command.empty")}</Command.Empty>
 */
Command.Empty = function CommandEmpty(handle: Handle<Command.EmptyProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="empty"
				data-command-empty
				mix={[pi(3), pb(6), textAlign("center"), fg("neutral.muted"), text("sm"), mix]}
			/>
		);
	};
};
