/**
 * A native `<select>` styled as a bordered, rounded field and progressively
 * upgraded with customizable-select rendering — a custom trigger button, a
 * value slot mirroring the current selection, and richly styled options and
 * groups — wherever the browser resolves `appearance: base-select`. The
 * trigger, value, and picker styling layer on top of ordinary
 * `<option>`/`<optgroup>` markup, so every browser renders a working
 * dropdown from that same markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg, outline, outlineStyle, outlineWidth } from "@sdxc/u/color";
import { opacity, rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
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
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, p, pb, pi } from "@sdxc/u/size";
import { data, hover, when } from "@sdxc/u/state";
import { text, textAlign, truncate } from "@sdxc/u/typography";
import { attrs } from "remix/component";

import { mirrorSelectedOption } from "../mixins/mirror-selected-option.js";

/**
 * The `<selectedcontent>` element mirrors the currently selected
 * `<option>`'s rendered content inside a customized `<select>`'s trigger
 * button, its attribute shape declared here to match a plain `<span>`'s.
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
const DEFAULT_ICON_ARIA_HIDDEN = "true";

/**
 * Prop types for {@link Select} and its compound parts.
 */
export namespace Select {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<select>` attribute, unchanged, plus the `mix` passthrough.
	 * `multiple` and a `size` greater than `1` remain functional but switch
	 * rendering back to the plain list-box; `role` is already implicit.
	 */
	/**
	 * `value` and `defaultValue` are left out on purpose. A `<select>` takes its selection
	 * from the option carrying `selected` and nothing else reads either attribute, so a
	 * value passed here goes unread and the field quietly shows its first option. Mark the
	 * option instead: `<Select.Option value="eu" selected>`.
	 */
	export interface Props extends Omit<TagProps<"select">, "role" | "defaultValue" | "value"> {
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
	 * passthrough. Any `children` supplied render as a fallback in browsers
	 * treating `<selectedcontent>` as unknown — see {@link Select.Value}.
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
 * Renders a native `<select>` styled as a bordered, rounded field that
 * progressively upgrades to customizable-select rendering via
 * `appearance: base-select`, falling back to the platform's own dropdown.
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
 * <Select aria-label={t("form.plan.label")} color="brand">
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
			/*
			 * Focus is drawn as a ring standing off the field, the same way every button in
			 * this library draws it, rather than by darkening the border: a border promoted
			 * to its strong weight and a ring sat flush against it read as one thick slab,
			 * which says the field changed shape rather than that it took focus. The border
			 * only steps to its hover weight, so nothing jumps.
			 *
			 * Pointer focus drops the platform outline and keyboard focus keeps the ring. The
			 * two selectors exclude each other because `outline: none` is a shorthand, and a
			 * shorthand reaching this element from a later cascade layer resets the ring's
			 * color, width and style all at once.
			 */
			when("&:focus:not(:focus-visible)", outline("none")),
			when("&:focus-visible", [
				border("neutral.border-hover"),
				outline({ color: "brand.ring", offset: 2 }),
				data("color", "success", outline("success.ring")),
				data("color", "warning", outline("warning.ring")),
				data("color", "danger", outline("danger.ring")),
			]),
			when('&[aria-invalid="true"], &:user-invalid', [
				outlineWidth("2px"),
				outlineStyle("solid"),
				raw({ outlineOffset: "2px" }),
			]),
			when("&:disabled", [cursor("not-allowed"), opacity(50)]),

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
			hover(border("neutral.border-hover")),
			when("&:focus", border("neutral.border-hover")),
			when('&[aria-invalid="true"], &:user-invalid', [
				border("danger"),
				outline({ color: "danger.ring", offset: 2 }),
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
 * Renders {@link Select}'s customizable trigger: a native `<button>` placed
 * as {@link Select}'s first child, showing {@link Select.Value} and a
 * rotating chevron by default, filling the field's box edge to edge.
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
							<ChevronDownIcon />
						</span>
					</>
				)}
			</button>
		);
	};
};

/**
 * Renders a native `<selectedcontent>` element inside {@link Select.Trigger},
 * mirroring the currently selected {@link Select.Option}'s content via the
 * platform; `children` render as a fallback where it's treated as unknown.
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
					mirrorSelectedOption(),
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
 * Renders a native `<option>` styled for the rounded, padded row a
 * supporting browser shows inside {@link Select}'s `::picker(select)`
 * dropdown, reading its own hover, focus, checked, and disabled states.
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
					when("&:focus", bg("brand.tint")),
					when("&:checked", [bg("brand.solid"), fg("brand.onSolid")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a native `<optgroup>` styled as a padded run of
 * {@link Select.Option}s, set off from the group before it by a
 * block-start divider on every group after the first.
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
