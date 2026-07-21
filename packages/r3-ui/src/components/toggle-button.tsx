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

import { attrs, css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { focusRingByColor } from "../styles/focus-ring";
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
 * <ToggleButton aria-pressed={filter === "active"} color="primary" name="filter" value="active">
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
					focusRingByColor(),
					interactiveTransition(),
					css({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						fontWeight: "500",
						cursor: "default",
						userSelect: "none",

						paddingInline: "1rem",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						'&[data-size="sm"]': {
							paddingInline: "0.75rem",
							paddingBlock: "0.375rem",
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},
						'&[data-size="lg"]': {
							paddingInline: "1.25rem",
							paddingBlock: "0.625rem",
							fontSize: "1rem",
							lineHeight: "1.5",
						},

						'&[data-variant="solid"]': {
							'&[data-color="primary"]': {
								backgroundColor: "var(--ui-primary-bg-solid)",
								color: "var(--ui-primary-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-solid-pressed)" },
							},
							'&[data-color="neutral"]': {
								backgroundColor: "var(--ui-neutral-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-solid-pressed)" },
							},
							'&[data-color="success"]': {
								backgroundColor: "var(--ui-success-bg-solid)",
								color: "var(--ui-success-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-solid-pressed)" },
							},
							'&[data-color="warning"]': {
								backgroundColor: "var(--ui-warning-bg-solid)",
								color: "var(--ui-warning-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-solid-pressed)" },
							},
							'&[data-color="danger"]': {
								backgroundColor: "var(--ui-danger-bg-solid)",
								color: "var(--ui-danger-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-solid-pressed)" },
							},
						},

						'&[data-variant="outline"]': {
							borderWidth: "2px",
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								borderColor: "var(--ui-primary-border-strong)",
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								borderColor: "var(--ui-neutral-border-strong)",
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							},
							'&[data-color="success"]': {
								borderColor: "var(--ui-success-border-strong)",
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								borderColor: "var(--ui-danger-border-strong)",
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								borderColor: "var(--ui-warning-border-strong)",
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
						},

						'&[data-variant="ghost"]': {
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-pressed)" },
							},
							'&[data-color="success"]': {
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
						},

						'&[aria-pressed="true"]': {
							'&[data-variant="outline"][data-color="primary"], &[data-variant="ghost"][data-color="primary"]':
								{
									backgroundColor: "var(--ui-primary-bg-tint)",
								},
							'&[data-variant="outline"][data-color="neutral"], &[data-variant="ghost"][data-color="neutral"]':
								{
									backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
								},
							'&[data-variant="outline"][data-color="success"], &[data-variant="ghost"][data-color="success"]':
								{
									backgroundColor: "var(--ui-success-bg-tint)",
								},
							'&[data-variant="outline"][data-color="danger"], &[data-variant="ghost"][data-color="danger"]':
								{
									backgroundColor: "var(--ui-danger-bg-tint)",
								},
							'&[data-variant="outline"][data-color="warning"], &[data-variant="ghost"][data-color="warning"]':
								{
									backgroundColor: "var(--ui-warning-bg-tint)",
								},
						},

						"&:disabled": {
							cursor: "not-allowed",
							opacity: "0.5",
						},
					}),
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
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.25rem",

						'&[data-orientation="vertical"]': {
							flexDirection: "column",
							alignItems: "flex-start",
						},
					}),
					mix,
				]}
			/>
		);
	};
}
