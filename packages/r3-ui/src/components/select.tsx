/**
 * A native `<select>` styled as a bordered, rounded field and progressively
 * upgraded with customizable-select rendering — a custom trigger button, a
 * value slot mirroring the current selection, and richly styled options and
 * groups — wherever the browser resolves `appearance: base-select`. A
 * browser that doesn't resolve it keeps the platform's own default dropdown
 * rendering instead, since the trigger, value, and picker styling all layer
 * on top of ordinary `<option>`/`<optgroup>` markup rather than replacing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ChevronDownIcon } from "@pkg/lucide-remix";
import { bg, border, borderEdge, fg, outline, outlineStyle, outlineWidth } from "@pkg/u/color";
import { opacity, rounded, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import {
	appearance,
	basis,
	flex,
	gap,
	grow,
	inlineFlex,
	items,
	justify,
	shrink,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, m, p, pb, pi } from "@pkg/u/size";
import { data, hover, when } from "@pkg/u/state";
import { text, textAlign, truncate } from "@pkg/u/typography";
import { attrs } from "remix/ui";

/**
 * The `<selectedcontent>` element mirrors the currently selected
 * `<option>`'s rendered content inside a customized `<select>`'s trigger
 * button. It isn't part of this runtime's own JSX element catalog yet, so
 * its attribute shape is declared here, matching a plain `<span>`'s.
 */
declare global {
	namespace JSX {
		interface IntrinsicHTMLElements {
			selectedcontent: IntrinsicHTMLElements["span"];
		}
	}
}

/** Semantic color role {@link Select} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Select.Color = "neutral";

/**
 * `type` {@link Select.Trigger} falls back to when a consumer doesn't supply
 * one, keeping a click on the trigger from submitting a surrounding `<form>`
 * the way a bare `<button>`'s default type otherwise would.
 */
const DEFAULT_TRIGGER_TYPE: NonNullable<Select.TriggerProps["type"]> = "button";

/**
 * `aria-hidden` applied through {@link attrs} to {@link Select.Trigger}'s
 * default chevron glyph unless a consumer overrides it, keeping the
 * decorative icon out of the accessibility tree.
 */
const DEFAULT_ICON_ARIA_HIDDEN = true;

/**
 * Prop types for {@link Select} and its compound parts.
 */
export namespace Select {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<select>` attribute, unchanged, plus the `mix` passthrough.
	 * `multiple` and a `size` greater than `1` both remain fully functional,
	 * but switch the browser back to its plain list-box rendering — see
	 * {@link Select}'s own description for what that means for the trigger and
	 * option styling. `role` is left off, since the platform already assigns
	 * a select element the correct implicit role on its own.
	 */
	export interface Props extends Omit<TagProps<"select">, "role"> {
		/** Semantic color role for the focus-visible ring. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	}

	/**
	 * Every native `<button>` attribute, unchanged, plus the `mix` passthrough.
	 * `type` defaults to {@link DEFAULT_TRIGGER_TYPE}.
	 */
	export interface TriggerProps extends TagProps<"button"> {}

	/**
	 * Every attribute a plain `<span>` accepts, unchanged, plus the `mix`
	 * passthrough. Any `children` supplied render only where the browser
	 * hasn't wired up the live-mirrored selection content — see
	 * {@link Select.Value}'s own description.
	 */
	export interface ValueProps extends TagProps<"selectedcontent"> {}

	/**
	 * Every native `<option>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface OptionProps extends TagProps<"option"> {}

	/**
	 * Every native `<optgroup>` attribute, unchanged, plus the `mix`
	 * passthrough.
	 */
	export interface GroupProps extends TagProps<"optgroup"> {}
}

/**
 * Renders a native `<select>` host styled as a bordered, rounded field and
 * opted into customizable-select rendering through `appearance: base-select`.
 * Where a browser resolves that value, an {@link Select.Trigger} placed as
 * this host's first child replaces the platform's own trigger with fully
 * styled content, the dropdown surface itself is styled through the
 * `::picker(select)` pseudo-element, and every {@link Select.Option} and
 * {@link Select.Group} renders with this library's own option and group
 * styling. Where a browser doesn't resolve it, the parser still accepts
 * {@link Select.Trigger} as valid content but the browser's own stylesheet
 * keeps it out of the render tree, so what's left is a plain native dropdown
 * built from the same `<option>`/`<optgroup>` markup — the box styling on
 * this host itself (border, radius, padding, color, and every interaction
 * state below) is ordinary CSS that always applies regardless.
 *
 * Hover, focus, and disabled states all ride this host's own native
 * `:hover`, `:focus-visible`, and `:disabled` pseudo-classes — there's no
 * tracked selection state anywhere in this module. Invalid styling reads
 * `[aria-invalid="true"]` (set directly, or mirrored in by a validation
 * script) together with `:user-invalid` (the platform's own post-interaction
 * validity signal), colored in the semantic danger tone regardless of
 * `color`. The keyboard focus ring reads `color` instead, defaulting to
 * {@link DEFAULT_COLOR}.
 *
 * A dimmed placeholder look — the one thing native `<select>` has no
 * built-in concept for — follows a plain convention: give the placeholder
 * {@link Select.Option} an empty `value` and `disabled`, and this host mutes
 * {@link Select.Value}'s color whenever that option is the checked one.
 *
 * In dev mode, setting `multiple` or a `size` greater than `1` logs a
 * `console.warn`, since both silently drop the customizable-select
 * rendering in favor of the browser's plain list-box, which can otherwise
 * look like a styling regression rather than a platform limit.
 *
 * @param handle Runtime handle carrying the host `<select>`'s props.
 * @returns The render function producing the field's markup.
 * @example
 * <Select aria-label={t("form.country.label")} required>
 * 	<Select.Option value="">{t("form.country.placeholder")}</Select.Option>
 * 	<Select.Option value="us">{t("countries.us")}</Select.Option>
 * 	<Select.Option value="ca">{t("countries.ca")}</Select.Option>
 * </Select>
 * @example
 * <Select aria-label={t("form.plan.label")} color="primary">
 * 	<Select.Trigger />
 * 	<Select.Group label={t("form.plan.groups.personal")}>
 * 		<Select.Option value="free">{t("plans.free")}</Select.Option>
 * 		<Select.Option value="pro">{t("plans.pro")}</Select.Option>
 * 	</Select.Group>
 * </Select>
 */
export function Select(handle: Handle<Select.Props>) {
	return () => {
		let { color, multiple, size, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		if (import.meta.env.DEV && (multiple || (typeof size === "number" && size > 1))) {
			console.warn(
				"Select: `appearance: base-select` styling has no effect on a `multiple` select or one with a `size` greater than 1 — the browser keeps its plain list-box rendering there instead of the customized trigger, value, and option styling.",
			);
		}

		let fieldMix = [
			flex(),
			items("center"),
			justify("between"),
			cursor("default"),
			text("sm"),
			when("&:focus", outline("none")),
			when("&:focus-visible", [
				border("neutral.strong"),
				outline({ color: "neutral.ring", offset: 0 }),
				data("color", "primary", [
					border("primary.strong"),
					outline({ color: "primary.ring", offset: 0 }),
				]),
				data("color", "neutral", [
					border("neutral.strong"),
					outline({ color: "neutral.ring", offset: 0 }),
				]),
				data("color", "success", [
					border("success.strong"),
					outline({ color: "success.ring", offset: 0 }),
				]),
				data("color", "warning", [
					border("warning.strong"),
					outline({ color: "warning.ring", offset: 0 }),
				]),
				data("color", "danger", [
					border("danger.strong"),
					outline({ color: "danger.ring", offset: 0 }),
				]),
			]),
			when('&[aria-invalid="true"], &:user-invalid', [
				outlineWidth("2px"),
				outlineStyle("solid"),
				// No bare setter exists yet for outline-offset alone.
				raw({ outlineOffset: "0px" }),
			]),
			when("&:disabled", [cursor("not-allowed"), opacity(50)]),

			// `&::picker(select)`/`&::picker-icon` selector blocks must stay
			// wrapped only in `raw()`, never `when()` — nesting either through
			// `when()` trips a pre-existing remix/ui generic-variance bug
			// specific to `HTMLSelectElement` (a `remove(): void` vs
			// `remove(): Element` structural mismatch), which only surfaces in
			// a consuming app's stricter typecheck.
			raw({
				"&::picker(select)": {
					margin: "0",
					inset: "auto",
					boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
					maxBlockSize: "15rem",
					overflow: "auto",
					padding: "0.25rem",
					outline: "none",
					opacity: "0",
					transitionProperty: "opacity, display, overlay",
					transitionDuration: "150ms",
					transitionBehavior: "allow-discrete",
					"@starting-style": {
						opacity: "0",
					},
				},
				"&:open": {
					"&::picker(select)": {
						opacity: "1",
					},
					'& [data-slot="icon"]': {
						transform: "rotate(180deg)",
					},
				},
				"&:has(option:checked:disabled)": {
					"& selectedcontent": {
						color: "var(--ui-neutral-fg-muted)",
					},
				},

				"@media (prefers-reduced-motion: reduce)": {
					"&::picker(select)": {
						transitionDuration: "0s",
					},
				},
			}),
			gap("0.5rem"),
			is("full"),
			bs("2.5rem"),
			rounded("md"),
			border({ color: "neutral", width: 1 }),
			bg("neutral.tint"),
			fg("neutral.emphasis"),
			pi("0.75rem"),
			pb("0.5rem"),
			appearance("base-select"),
			transition(
				"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
			),
			hover(border("neutral.strong")),
			when("&:focus", border("neutral.strong")),
			when('&[aria-invalid="true"], &:user-invalid', [
				border("danger.strong"),
				outline({ color: "danger.ring", offset: 0 }),
			]),
			when("&:disabled", bg("neutral.bg-tint-hover")),
			raw({
				"&::picker(select)": {
					borderRadius: "var(--ui-radius-lg, 0.5rem)",
					borderWidth: "1px",
					borderStyle: "solid",
					borderColor: "var(--ui-neutral-border)",
					backgroundColor: "var(--ui-neutral-bg-tint)",
				},
				"&::picker-icon": {
					color: "var(--ui-neutral-fg-muted)",
				},
			}),
			mix,
		] as unknown as Select.Props["mix"];

		return (
			<select multiple={multiple} size={size} data-color={resolvedColor} {...rest} mix={fieldMix} />
		);
	};
}

/**
 * Renders {@link Select}'s customizable trigger: a native `<button>`, placed
 * as {@link Select}'s first child, that a supporting browser shows in place
 * of its own default trigger. Left without `children`, it renders
 * {@link Select.Value} followed by a chevron glyph that rotates while the
 * dropdown is open; passing `children` replaces that default entirely with
 * whatever content a consumer composes instead. The button carries no border,
 * background, or padding of its own — it fills {@link Select}'s own field
 * box exactly, so the styled surface stays a single, seamless shape.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <Select.Trigger />
 * @example
 * <Select.Trigger>
 * 	<Select.Value>{t("form.plan.placeholder")}</Select.Value>
 * </Select.Trigger>
 */
Select.Trigger = function SelectTrigger(handle: Handle<Select.TriggerProps>) {
	return () => {
		let { type, children, mix, ...rest } = handle.props;

		return (
			<button
				type={type ?? DEFAULT_TRIGGER_TYPE}
				{...rest}
				mix={[
					flex(),
					items("center"),
					justify("between"),
					gap("0.5rem"),
					is("full"),
					bs("full"),
					m(0),
					p(0),
					border({ width: 0, style: "none" }),
					bg("transparent"),
					fg("inherit"),
					raw({ font: "inherit" }),
					textAlign("start"),
					cursor("inherit"),
					mix,
				]}
			>
				{children ?? (
					<>
						<Select.Value />
						<span
							data-slot="icon"
							mix={[
								attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
								inlineFlex(),
								shrink(),
								transition("transform"),
								when("& svg", [is("1rem"), bs("1rem")]),
								media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
								fg("neutral.muted"),
							]}
						>
							<ChevronDownIcon aria-hidden />
						</span>
					</>
				)}
			</button>
		);
	};
};

/**
 * Renders a native `<selectedcontent>` element inside {@link Select.Trigger}:
 * a live-mirrored copy of the currently selected {@link Select.Option}'s
 * content, kept in sync by the platform with no script of this library's
 * own. Any `children` supplied render only in a browser that treats
 * `<selectedcontent>` as a plain unknown element instead of mirroring the
 * selection into it — a static fallback for that case, never shown
 * alongside the mirrored content.
 *
 * @param handle Runtime handle carrying the host element's props.
 * @returns The render function producing the value slot's markup.
 * @example
 * <Select.Value />
 * @example
 * <Select.Value>{t("form.plan.placeholder")}</Select.Value>
 */
Select.Value = function SelectValue(handle: Handle<Select.ValueProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<selectedcontent
				{...rest}
				mix={[
					// `flex: "1"` shorthand decomposes to grow(1) + shrink(1) +
					// basis("0%") — no single utility covers the shorthand
					// itself (see `packages/u/src/layout/grow.ts` docs).
					grow(),
					shrink(1),
					basis("0%"),
					truncate(),
					textAlign("start"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<option>`, styled for the rounded, padded row a
 * supporting browser shows inside {@link Select}'s `::picker(select)`
 * dropdown surface. Hover, keyboard-highlighted, selected, and disabled looks
 * read the option's own `:hover`, `:focus`, `:checked`, and `:disabled`
 * states — a browser that doesn't resolve `appearance: base-select` ignores
 * this styling and renders the option through its own plain list rendering
 * instead, with no loss of the option's value or text.
 *
 * @param handle Runtime handle carrying the host `<option>`'s props.
 * @returns The render function producing the option's markup.
 * @example
 * <Select.Option value="us">{t("countries.us")}</Select.Option>
 * @example
 * <Select.Option value="" disabled>{t("form.country.placeholder")}</Select.Option>
 */
Select.Option = function SelectOption(handle: Handle<Select.OptionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<option
				{...rest}
				mix={[
					cursor("default"),
					pi("0.75rem"),
					pb("0.5rem"),
					text("sm"),
					outline("none"),
					when("&:disabled", opacity(50)),
					when("&::checkmark", fg("currentColor")),
					rounded("md"),
					fg("neutral.emphasis"),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke",
					),
					when("&:hover", bg("neutral.bg-tint-hover")),
					when("&:active", bg("neutral.bg-tint-pressed")),
					when("&:focus", bg("primary.tint")),
					when("&:checked", [bg("primary.solid"), fg("primary.onSolid")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<optgroup>`, styled as a padded run of
 * {@link Select.Option}s set off from the group before it by a block-start
 * divider — the first group in a {@link Select} carries no divider of its
 * own, since there's nothing above it to separate from.
 *
 * In dev mode, an `<optgroup>` with no `label` logs a `console.warn`, since
 * it would otherwise render with no visible heading for the options grouped
 * under it.
 *
 * @param handle Runtime handle carrying the host `<optgroup>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Select.Group label={t("form.plan.groups.personal")}>
 * 	<Select.Option value="free">{t("plans.free")}</Select.Option>
 * 	<Select.Option value="pro">{t("plans.pro")}</Select.Option>
 * </Select.Group>
 */
Select.Group = function SelectGroup(handle: Handle<Select.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !rest.label) {
			console.warn(
				"Select.Group: an `optgroup` with no `label` renders with no visible heading for its options — pass a `label` describing the group.",
			);
		}

		return (
			<optgroup
				{...rest}
				mix={[
					when("&:not(:first-child)", borderEdge("block-start", { width: 1 })),
					pb("0.25rem"),
					when("&:not(:first-child)", border("neutral")),
					mix,
				]}
			/>
		);
	};
};
