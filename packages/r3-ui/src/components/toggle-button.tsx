/**
 * A native `<button>` that reflects an on/off state through its own
 * `aria-pressed` attribute instead of a separate boolean prop — muting a
 * track, toggling bold text, filtering a view. Shares {@link Button}'s
 * semantic color role, visual weight variant, and size, and layers a tinted
 * background on top of the outline and ghost variants once pressed, so a
 * toggled control reads as active without a fourth variant of its own.
 * {@link ToggleButtonGroup} lays a run of these out along a shared axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { rounded, opacity } from "@pkg/u/effects";
import { cursor, userSelect } from "@pkg/u/general";
import { flex, flexCol, inlineFlex, items, justify, gap } from "@pkg/u/layout";
import { pi, pb } from "@pkg/u/size";
import { when, hover, active, data } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

/** Semantic color role {@link ToggleButton} falls back to when `color` is omitted. */
const DEFAULT_COLOR: ToggleButton.Color = "neutral";

/** Visual weight {@link ToggleButton} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: ToggleButton.Variant = "outline";

/** Size variant {@link ToggleButton} falls back to when `size` is omitted. */
const DEFAULT_SIZE: ToggleButton.Size = "md";

/** Role {@link ToggleButtonGroup} carries by default, matching the arrow-key-navigable pattern a row of grouped toggle buttons follows. */
const DEFAULT_GROUP_ROLE = "toolbar";

/** Layout axis {@link ToggleButtonGroup} falls back to when `orientation` is omitted. */
const DEFAULT_GROUP_ORIENTATION: ToggleButtonGroup.Orientation = "horizontal";

/**
 * Prop types for {@link ToggleButton}.
 */
export namespace ToggleButton {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Visual weight the button renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label. Pressing layers a tinted
	 * background on top of `"outline"` and `"ghost"`; `"solid"` already reads
	 * as filled and renders the same whether pressed or not.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the button's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link ToggleButton}. Every native `<button>`
	 * attribute is available unchanged except `aria-pressed`, which becomes
	 * required: it carries the control's entire pressed/unpressed state, read
	 * straight off the rendered attribute by both this component's own
	 * styling and the `pressToggle()` mixin, with no separate tracked prop
	 * that could drift out of sync with it.
	 */
	export interface Props extends Omit<TagProps<"button">, "aria-pressed"> {
		/** The button's pressed state, reflected directly onto the host's own `aria-pressed` attribute. */
		"aria-pressed": NonNullable<TagProps<"button">["aria-pressed"]>;
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	}
}

/**
 * Renders a native `<button aria-pressed>` host, colored and shaped through
 * the same `data-color`, `data-variant`, and `data-size` attribute contract
 * as {@link Button}. Once `aria-pressed="true"`, the `"outline"` and
 * `"ghost"` variants gain a tinted background matching the button's semantic
 * color, so a pressed toggle reads as active at a glance; `"solid"` needs no
 * such treatment since it already renders fully filled either way.
 *
 * Clicking the button submits its enclosing form by default — the baseline
 * this component ships with, requiring no script at all: a server round-trip
 * flips the state and re-renders the button with `aria-pressed` already
 * updated. Pair the `pressToggle()` mixin through `mix` in a hydrated island
 * for a client-side toggle that skips the round-trip.
 *
 * In dev mode, a toggle whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the toggle button's markup.
 * @example
 * <ToggleButton aria-pressed={isMuted} aria-label={t("player.mute")}>
 * 	<VolumeXIcon />
 * </ToggleButton>
 * @example
 * <ToggleButton aria-pressed={isBold} variant="ghost" size="sm" aria-label={t("editor.bold")}>
 * 	<BoldIcon />
 * </ToggleButton>
 * @example
 * <ToggleButton aria-pressed={filter === "active"} color="brand" name="filter" value="active">
 * 	{t("tasks.filterActive")}
 * </ToggleButton>
 */
export function ToggleButton(handle: Handle<ToggleButton.Props>) {
	return () => {
		let { color, variant, size, children, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"ToggleButton: an icon-only toggle needs an `aria-label` describing what it does — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<button
				{...rest}
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				mix={[
					when("&:focus-visible", [
						outline({ color: "brand.ring", offset: 2 }),
						when('&[data-color="neutral"]', outline("neutral.ring")),
						when('&[data-color="success"]', outline("success.ring")),
						when('&[data-color="warning"]', outline("warning.ring")),
						when('&[data-color="danger"]', outline("danger.ring")),
					]),
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					gap("0.5rem"),
					rounded("md"),
					weight(500),
					cursor("default"),
					userSelect(),
					pi("1rem"),
					pb("0.5rem"),
					when('&[data-size="sm"]', [pi("0.75rem"), pb("0.375rem")]),
					when('&[data-size="lg"]', [pi("1.25rem"), pb("0.625rem")]),
					text("sm"),
					data("size", "sm", text("xs")),
					data("size", "lg", text("base")),
					when('&[data-variant="solid"]', [
						when('&[data-color="brand"]', [
							bg("brand.bg-solid"),
							fg("brand.fg-on-solid"),
							hover(bg("brand.bg-solid-hover")),
							active(bg("brand.bg-solid-pressed")),
						]),
						when('&[data-color="neutral"]', [
							bg("neutral.bg-solid"),
							fg("neutral.fg-on-solid"),
							hover(bg("neutral.bg-solid-hover")),
							active(bg("neutral.bg-solid-pressed")),
						]),
						when('&[data-color="success"]', [
							bg("success.bg-solid"),
							fg("success.fg-on-solid"),
							hover(bg("success.bg-solid-hover")),
							active(bg("success.bg-solid-pressed")),
						]),
						when('&[data-color="warning"]', [
							bg("warning.bg-solid"),
							fg("warning.fg-on-solid"),
							hover(bg("warning.bg-solid-hover")),
							active(bg("warning.bg-solid-pressed")),
						]),
						when('&[data-color="danger"]', [
							bg("danger.bg-solid"),
							fg("danger.fg-on-solid"),
							hover(bg("danger.bg-solid-hover")),
							active(bg("danger.bg-solid-pressed")),
						]),
					]),
					when('&[data-variant="outline"]', [
						border({ width: 2, noStyleDefault: true }),
						bg("transparent"),
					]),
					when('&[data-variant="ghost"]', bg("transparent")),
					when('&[data-variant="outline"]', [
						when('&[data-color="brand"]', [
							border("brand.border-strong"),
							fg("brand.fg"),
							hover(bg("brand.bg-tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							border("neutral.border-strong"),
							fg("neutral.fg"),
							hover(bg("neutral.bg-tint")),
							active(bg("neutral.bg-tint-hover")),
						]),
						when('&[data-color="success"]', [
							border("success.border-strong"),
							fg("success.fg"),
							hover(bg("success.bg-tint")),
							active(bg("success.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							border("danger.border-strong"),
							fg("danger.fg"),
							hover(bg("danger.bg-tint")),
							active(bg("danger.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							border("warning.border-strong"),
							fg("warning.fg"),
							hover(bg("warning.bg-tint")),
							active(bg("warning.bg-tint-hover")),
						]),
					]),
					when('&[data-variant="ghost"]', [
						when('&[data-color="brand"]', [
							fg("brand.fg"),
							hover(bg("brand.bg-tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							fg("neutral.fg"),
							hover(bg("neutral.bg-tint-hover")),
							active(bg("neutral.bg-tint-pressed")),
						]),
						when('&[data-color="success"]', [
							fg("success.fg"),
							hover(bg("success.bg-tint")),
							active(bg("success.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							fg("danger.fg"),
							hover(bg("danger.bg-tint")),
							active(bg("danger.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							fg("warning.fg"),
							hover(bg("warning.bg-tint")),
							active(bg("warning.bg-tint-hover")),
						]),
					]),
					when('&[aria-pressed="true"]', [
						when(
							'&[data-variant="outline"][data-color="brand"], &[data-variant="ghost"][data-color="brand"]',
							bg("brand.bg-tint"),
						),
						when(
							'&[data-variant="outline"][data-color="neutral"], &[data-variant="ghost"][data-color="neutral"]',
							bg("neutral.bg-tint-pressed"),
						),
						when(
							'&[data-variant="outline"][data-color="success"], &[data-variant="ghost"][data-color="success"]',
							bg("success.bg-tint"),
						),
						when(
							'&[data-variant="outline"][data-color="danger"], &[data-variant="ghost"][data-color="danger"]',
							bg("danger.bg-tint"),
						),
						when(
							'&[data-variant="outline"][data-color="warning"], &[data-variant="ghost"][data-color="warning"]',
							bg("warning.bg-tint"),
						),
					]),
					when("&:disabled", opacity(50)),
					when("&:disabled", cursor("not-allowed")),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
}

/**
 * Prop types for {@link ToggleButtonGroup}.
 */
export namespace ToggleButtonGroup {
	/**
	 * Axis a group's toggle buttons lay out along: a single row, or a single
	 * column.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Each {@link ToggleButton} nested inside keeps its own `aria-pressed`
	 * state and its own `name`/`value` for form submission entirely on its
	 * own — this host contributes only the shared grouping semantics and
	 * layout.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_GROUP_ORIENTATION}. */
		orientation?: Orientation;
	}
}

/**
 * Renders a `role="toolbar"` `<div>` laying a run of independently pressed
 * {@link ToggleButton} children out in a row, switching to a column when
 * `orientation` is `"vertical"`. Every toggle button nested inside keeps
 * tracking its own `aria-pressed` state entirely on its own — there is no
 * shared selection state anywhere in this module, only shared layout and
 * grouping semantics.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <ToggleButtonGroup aria-label={t("editor.textStyle")}>
 * 	<ToggleButton aria-pressed={isBold} aria-label={t("editor.bold")}>
 * 		<BoldIcon />
 * 	</ToggleButton>
 * 	<ToggleButton aria-pressed={isItalic} aria-label={t("editor.italic")}>
 * 		<ItalicIcon />
 * 	</ToggleButton>
 * </ToggleButtonGroup>
 * @example
 * <ToggleButtonGroup aria-label={t("editor.alignment")} orientation="vertical">
 * 	<ToggleButton aria-pressed={align === "start"} aria-label={t("editor.alignStart")}>
 * 		<AlignStartIcon />
 * 	</ToggleButton>
 * 	<ToggleButton aria-pressed={align === "center"} aria-label={t("editor.alignCenter")}>
 * 		<AlignCenterIcon />
 * 	</ToggleButton>
 * </ToggleButtonGroup>
 */
export function ToggleButtonGroup(handle: Handle<ToggleButtonGroup.Props>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_GROUP_ORIENTATION;

		return (
			<div
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[
					attrs({ role: DEFAULT_GROUP_ROLE }),
					flex(),
					items("center"),
					gap("0.25rem"),
					when('&[data-orientation="vertical"]', [flexCol(), items("start")]),
					mix,
				]}
			/>
		);
	};
}
