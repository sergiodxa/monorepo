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

import { attrs, css } from "remix/ui";

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
	 * which styles the control itself rather than the row wrapping it. A type
	 * alias rather than an interface, since the native input prop type resolves
	 * through a conditional type keyed on `type` that an `interface … extends`
	 * clause can't statically extend.
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
		 * behavior matches the text a person types against this value rather
		 * than parsing whatever markup `children` renders, so it stays required
		 * even when the visible content is already plain text.
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
				mix={[
					floatingSurface(),
					css({
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders the panel's query row: a `<div>` bordered along its block-end edge
 * wrapping a native `<input>` with no box, border, or background of its own —
 * the row's own border is what reads as the field's edge, sitting flush
 * against {@link Command}'s top corners. The input's placeholder renders
 * muted, a keyboard focus-visible ring reads in the primary color, and a
 * disabled input dims to half opacity with a "not-allowed" cursor.
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
			<div
				data-slot="input-wrapper"
				mix={css({
					borderBlockEndWidth: "1px",
					borderBlockEndStyle: "solid",
					borderColor: "var(--ui-neutral-border)",
					paddingInline: "0.75rem",
					paddingBlock: "0.5rem",
				})}
			>
				<input
					{...rest}
					data-slot="input"
					mix={[
						css({
							inlineSize: "100%",
							blockSize: "2.5rem",
							backgroundColor: "transparent",
							fontSize: "0.875rem",
							lineHeight: "calc(1.25 / 0.875)",
							outlineStyle: "none",
							color: "var(--ui-neutral-fg-emphasis)",

							"&::placeholder": {
								color: "var(--ui-neutral-fg-muted)",
							},
							"&:focus-visible": {
								outlineWidth: "2px",
								outlineStyle: "solid",
								outlineOffset: "2px",
								outlineColor: "var(--ui-primary-ring)",
							},
							"&:disabled": {
								cursor: "not-allowed",
								opacity: "0.5",
							},
						}),
						mix,
					]}
				/>
			</div>
		);
	};
};

/**
 * Renders the panel's scrollable option region: a `<div>` carrying the
 * `listbox` role, capped at a fixed block size with its own padding once
 * {@link Command.Item} rows grow past a handful of entries.
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
					css({
						maxBlockSize: "18rem",
						overflow: "auto",
						padding: "0.5rem",
						outlineStyle: "none",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single row: a `<div>` carrying the `option` role, its `value`
 * mirrored onto a `data-value` attribute so a paired filter behavior can read
 * it without parsing `children`. The row renders as a plain, static element by
 * default — nest a `<button>` or `<a>` inside `children` to give it its own
 * native activation, or set `aria-selected="true"` directly to read it as the
 * currently highlighted row. Setting `aria-disabled="true"` mutes the row.
 *
 * In dev mode, an item rendered without a `value` logs a `console.warn`,
 * since a filter behavior matching against typed text would otherwise have
 * nothing to compare it to.
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
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						cursor: "default",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						paddingInline: "0.75rem",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						outlineStyle: "none",
						color: "var(--ui-neutral-fg-emphasis)",

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
						"&:active": {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						"&:focus": {
							backgroundColor: "var(--ui-primary-bg-tint)",
						},
						'&[aria-selected="true"]': {
							backgroundColor: "var(--ui-primary-bg-solid)",
							color: "var(--ui-primary-fg-on-solid)",
						},
						'&[aria-disabled="true"]': {
							opacity: "0.5",
						},
					}),
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
 * text filling {@link Command.List}'s content area. A paired filter behavior
 * decides when to show it; render it unconditionally in a page that never
 * hydrates that behavior, or alongside {@link Command.List} for one that does.
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
				mix={[
					css({
						paddingInline: "0.75rem",
						paddingBlock: "1.5rem",
						textAlign: "center",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg-muted)",
					}),
					mix,
				]}
			/>
		);
	};
};
