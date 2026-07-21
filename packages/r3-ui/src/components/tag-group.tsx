/**
 * A labeled set of pill-shaped tags with an optional dismiss control per tag,
 * composing a grouping host, a wrapped list, and each tag's own pill and
 * remove button. A tag reads its color and size through the same `data-*`
 * contract as {@link Badge}, and its remove control renders through
 * {@link Button} as a native form submit, so removing a tag is an ordinary
 * server round-trip through whatever form the group sits inside, driven
 * entirely by the submitted control's `name`/`value` pair.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as ElementProps } from "remix/ui";

import { XIcon } from "@pkg/lucide-remix";
import { attrs, css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingByColor } from "../styles/focus-ring";
import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { Button } from "./button";

/** `role="group"` applied to {@link TagGroup} through {@link attrs} unless a consumer supplies its own `role`. */
const DEFAULT_ROLE = "group";

/** Semantic color role {@link TagGroup.Tag} falls back to when `color` is omitted. */
const DEFAULT_COLOR: TagGroup.Color = "neutral";

/** Size variant {@link TagGroup.Tag} falls back to when `size` is omitted. */
const DEFAULT_SIZE: TagGroup.Size = "md";

/**
 * Prop types for {@link TagGroup} and its compound parts.
 */
export namespace TagGroup {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables —
	 * the same set {@link Badge} and {@link Button} use.
	 */
	export type Color = SemanticColor;

	/**
	 * Size variant controlling a tag's padding and font size.
	 */
	export type Size = "sm" | "md";

	/**
	 * Props accepted by {@link TagGroup}.
	 */
	export interface Props extends ElementProps<"div"> {}

	/**
	 * Props accepted by {@link TagGroup.List}.
	 */
	export interface ListProps extends ElementProps<"ul"> {}

	/**
	 * Props accepted by {@link TagGroup.Tag}. Set `aria-selected="true"` to
	 * mark a tag as the active member of a selectable set, and
	 * `aria-disabled="true"` to mute one that shouldn't be interacted with —
	 * both read straight from their native ARIA attributes, with no
	 * client-tracked selection state anywhere in this module.
	 */
	export interface TagProps extends ElementProps<"li"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	}

	/**
	 * Props accepted by {@link TagGroup.Remove}: every {@link Button.Props}
	 * field except the ones this component fixes on the consumer's behalf.
	 * Every native `<button>` attribute otherwise still applies unchanged —
	 * `name` and `value` are what a consumer sets to tell an enclosing form
	 * which tag was submitted for removal.
	 */
	export interface RemoveProps extends Omit<
		Button.Props,
		"children" | "variant" | "color" | "size" | "type" | "aria-label"
	> {
		/**
		 * Accessible label for the icon-only control — required, since the
		 * button carries no visible text for assistive technology to read.
		 */
		"aria-label": string;
	}
}

/**
 * Renders the group's `<div>` host, laying its {@link TagGroup.List} child
 * (and any preceding `Label`) out in a column with a small gap. In dev mode,
 * a group rendered without an `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name to announce for the set.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <TagGroup aria-label={t("skills.label")}>
 * 	<TagGroup.List>
 * 		<TagGroup.Tag color="primary">{t("skills.design")}</TagGroup.Tag>
 * 		<TagGroup.Tag color="success">{t("skills.shipped")}</TagGroup.Tag>
 * 	</TagGroup.List>
 * </TagGroup>
 */
export function TagGroup(handle: Handle<TagGroup.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'TagGroup: a group with no "aria-label" or "aria-labelledby" needs one describing the set of tags — assistive technology has no accessible name to announce otherwise.',
		);

		return (
			<div
				{...rest}
				data-slot="tag-group"
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the group's `<ul>` list, resetting native list markers and spacing
 * and laying {@link TagGroup.Tag} children out as a wrapped row with a small
 * gap between them.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <TagGroup.List>
 * 	<TagGroup.Tag color="neutral">{t("filters.active")}</TagGroup.Tag>
 * 	<TagGroup.Tag color="neutral" size="sm">{t("filters.archived")}</TagGroup.Tag>
 * </TagGroup.List>
 */
TagGroup.List = function TagGroupList(handle: Handle<TagGroup.ListProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ul
				{...rest}
				data-slot="list"
				mix={[
					css({
						display: "flex",
						flexWrap: "wrap",
						gap: "0.5rem",
						listStyle: "none",
						margin: "0",
						padding: "0",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single pill-shaped `<li>`, colored through the `data-color`
 * attribute contract shared with {@link Badge} and sized through
 * `data-size`. Compose a {@link TagGroup.Remove} as a trailing child for a
 * dismissible tag — the pill itself carries no remove control unless one is
 * placed inside it explicitly.
 *
 * Setting `aria-selected="true"` fills the pill with the primary solid
 * background, its on-solid foreground, and a heavier label weight, marking
 * it the active member of a selectable set with no client-tracked selection
 * state involved. Setting `aria-disabled="true"` mutes the pill. A keyboard
 * focus-visible ring reads in the tag's own semantic color, for a consumer
 * that makes the pill itself focusable (a filter tag toggled through the
 * `pressToggle()` mixin, for instance).
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the pill's markup.
 * @example
 * <TagGroup.Tag color="success">{t("status.shipped")}</TagGroup.Tag>
 * @example
 * <TagGroup.Tag color="danger" size="sm" aria-selected="true">
 * 	{t("status.blocked")}
 * </TagGroup.Tag>
 */
TagGroup.Tag = function TagGroupTag(handle: Handle<TagGroup.TagProps>) {
	return () => {
		let { color, size, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedSize = size ?? DEFAULT_SIZE;

		return (
			<li
				{...rest}
				data-color={resolvedColor}
				data-size={resolvedSize}
				data-slot="tag"
				mix={[
					focusRingByColor(),
					interactiveTransition(),
					css({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						cursor: "default",
						borderRadius: "var(--ui-radius-full, 9999px)",
						paddingInline: "0.75rem",
						paddingBlock: "0.25rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						'&[data-size="sm"]': {
							paddingInline: "0.5rem",
							paddingBlock: "0.125rem",
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},

						'&[data-color="neutral"]': {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							color: "var(--ui-neutral-fg)",
						},
						'&[data-color="primary"]': {
							backgroundColor: "var(--ui-primary-bg-tint)",
							color: "var(--ui-primary-fg)",
						},
						'&[data-color="success"]': {
							backgroundColor: "var(--ui-success-bg-tint)",
							color: "var(--ui-success-fg)",
						},
						'&[data-color="warning"]': {
							backgroundColor: "var(--ui-warning-bg-tint)",
							color: "var(--ui-warning-fg)",
						},
						'&[data-color="danger"]': {
							backgroundColor: "var(--ui-danger-bg-tint)",
							color: "var(--ui-danger-fg)",
						},

						'&[aria-selected="true"]': {
							backgroundColor: "var(--ui-primary-bg-solid)",
							color: "var(--ui-primary-fg-on-solid)",
							fontWeight: "600",
						},

						'&[aria-disabled="true"]': {
							opacity: "0.5",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a dismiss control for the tag it's composed inside: a small,
 * ghost-styled {@link Button} carrying a fixed "X" glyph, submitting as
 * `type="submit"` so a click removes the tag by posting the enclosing
 * form — no JavaScript required. Its own foreground and hover/pressed/
 * focus-visible colors read from the ambient {@link TagGroup.Tag}'s
 * `data-color` rather than a color of its own, so the control always matches
 * the pill it sits inside.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <form method="post">
 * 	<TagGroup aria-label={t("filters.label")}>
 * 		<TagGroup.List>
 * 			<TagGroup.Tag color="primary">
 * 				{t("filters.remote")}
 * 				<TagGroup.Remove name="remove" value="remote" aria-label={t("filters.removeRemote")} />
 * 			</TagGroup.Tag>
 * 		</TagGroup.List>
 * 	</TagGroup>
 * </form>
 */
TagGroup.Remove = function TagGroupRemove(handle: Handle<TagGroup.RemoveProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Button
				{...rest}
				type="submit"
				variant="ghost"
				data-slot="remove"
				mix={[
					css({
						color: "currentColor",
						marginInlineEnd: "-0.25rem",
						paddingBlock: "0.125rem",
						paddingInline: "0.125rem",
						borderRadius: "var(--ui-radius-full, 9999px)",

						"& svg": {
							inlineSize: "0.75rem",
							blockSize: "0.75rem",
						},

						"&:hover": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
						'[data-color="neutral"] &:hover': {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						},
						'[data-color="success"] &:hover': {
							backgroundColor: "var(--ui-success-bg-tint-hover)",
						},
						'[data-color="danger"] &:hover': { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
						'[data-color="warning"] &:hover': {
							backgroundColor: "var(--ui-warning-bg-tint-hover)",
						},

						"&:active": { backgroundColor: "var(--ui-primary-bg-tint-pressed)" },
						'[data-color="neutral"] &:active': {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						'[data-color="success"] &:active': {
							backgroundColor: "var(--ui-success-bg-tint-pressed)",
						},
						'[data-color="danger"] &:active': {
							backgroundColor: "var(--ui-danger-bg-tint-pressed)",
						},
						'[data-color="warning"] &:active': {
							backgroundColor: "var(--ui-warning-bg-tint-pressed)",
						},

						"&:focus-visible": { outlineColor: "var(--ui-primary-ring)" },
						'[data-color="neutral"] &:focus-visible': { outlineColor: "var(--ui-neutral-ring)" },
						'[data-color="success"] &:focus-visible': { outlineColor: "var(--ui-success-ring)" },
						'[data-color="danger"] &:focus-visible': { outlineColor: "var(--ui-danger-ring)" },
						'[data-color="warning"] &:focus-visible': { outlineColor: "var(--ui-warning-ring)" },
					}),
					mix,
				]}
			>
				<XIcon aria-hidden size={12} />
			</Button>
		);
	};
};
