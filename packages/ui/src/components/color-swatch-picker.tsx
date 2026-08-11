/**
 * A set of mutually exclusive color options built from native `<input
 * type="radio">` controls sharing one grouping name, rendered as a
 * `role="radiogroup"` host wrapping a run of {@link ColorSwatchPicker.Swatch}
 * instances. Each option pairs a visually hidden native input — carrying
 * every focus, keyboard, and form-submission semantic the platform already
 * provides — with a {@link ColorSwatch} indicator reading the input's own
 * `:checked` and `:focus-visible` states through sibling selectors, the same
 * technique a plain radio option uses for its own dot-and-ring indicator.
 * Selecting an option works purely from this markup and its styling, with no
 * script involved at any point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { border, outline } from "@pkg/u/color";
import { opacity, ringShadow, transition } from "@pkg/u/effects";
import { cursor } from "@pkg/u/general";
import { flexWrap, hstack, inlineFlex } from "@pkg/u/layout";
import { precededBy, when } from "@pkg/u/state";
import { attrs } from "remix/ui";

import { ColorSwatch } from "./color-swatch";

/**
 * `role="radiogroup"` applied through {@link attrs} unless a consumer
 * supplies its own `role`, announcing the host as a radio group landmark to
 * assistive technology.
 */
const DEFAULT_ROLE = "radiogroup";

/**
 * Prop types for {@link ColorSwatchPicker} and its
 * {@link ColorSwatchPicker.Swatch} compound part.
 */
export namespace ColorSwatchPicker {
	/**
	 * Value {@link ColorSwatchPicker} stores in component context so every
	 * {@link ColorSwatchPicker.Swatch} nested inside shares the same native
	 * grouping name without a consumer repeating it on each option.
	 */
	export interface Context {
		/** Shared `name` every {@link ColorSwatchPicker.Swatch} reads unless it sets its own. */
		name: string;
	}

	/**
	 * Props accepted by {@link ColorSwatchPicker}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Native grouping name shared by every {@link ColorSwatchPicker.Swatch}
		 * nested inside, provided through component context. Defaults to the
		 * group's own {@link Handle.id | stable instance id} when omitted, so
		 * options always group correctly even when a consumer never sets a
		 * name.
		 */
		name?: string;
	}

	/**
	 * Props accepted by {@link ColorSwatchPicker.Swatch}.
	 */
	export interface SwatchProps extends Omit<TagProps<"label">, "children" | "aria-label"> {
		/**
		 * The color this option submits and previews, already resolved to a
		 * literal CSS color value (a hex string, `rgb()`/`hsl()`/`oklch()`
		 * function, or named color) — the same value {@link ColorSwatch} paints
		 * its indicator with, and the value submitted with the enclosing form
		 * when this option is selected.
		 */
		value: string;
		/**
		 * Accessible name announced for this option in place of visible text.
		 * The indicator paints only a color and carries no text alternative of
		 * its own, so this is what identifies the option to assistive
		 * technology — a color's name, for instance — and is required since
		 * there is no visible label to fall back on.
		 */
		"aria-label": string;
		/**
		 * Native grouping name for this option's underlying input. Defaults to
		 * the name provided by the nearest ancestor {@link ColorSwatchPicker} —
		 * set this only to opt a single option out of its group's shared name.
		 */
		name?: string;
		/** The indicator's shape variant, forwarded to {@link ColorSwatch}. */
		shape?: ColorSwatch.Shape;
		/** The indicator's size variant, forwarded to {@link ColorSwatch}. */
		size?: ColorSwatch.Size;
		/** Whether this option starts selected, for a form that never tracks selection itself. */
		defaultChecked?: boolean;
		/** Whether this option is selected, for a form that tracks selection itself. */
		checked?: boolean;
		/** Whether this option is inert and excluded from the group's tab order. */
		disabled?: boolean;
		/** Marks the enclosing native radio group as requiring one option selected. */
		required?: boolean;
		/**
		 * Per-part styling for the option's hidden `input` and its
		 * {@link ColorSwatch} indicator, layered after each part's own built-in
		 * styling. Use the `mix` prop instead to style the option's outer
		 * `<label>` host.
		 */
		parts?: {
			/** Additional mixin(s) applied to the hidden native `<input type="radio">`. */
			input?: TagProps<"input">["mix"];
			/** Additional mixin(s) applied to the {@link ColorSwatch} indicator. */
			indicator?: TagProps<"span">["mix"];
		};
	}
}

/**
 * Renders the group host: a `role="radiogroup"` `<div>` laying its
 * {@link ColorSwatchPicker.Swatch} options out in a wrapping row, so a long
 * run of colors flows onto as many rows as the host's width needs rather than
 * overflowing a single line. Every option nested inside reads its shared
 * native `name` from component context, defaulting to the group's own stable
 * identifier so grouping always works correctly even when a consumer never
 * sets `name` explicitly.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link ColorSwatchPicker.Context}.
 * @returns The render function producing the group's markup.
 * @example
 * <ColorSwatchPicker aria-label={t("form.accentColor.label")} name="accentColor">
 * 	<ColorSwatchPicker.Swatch value="#ef4444" aria-label={t("color.red")} />
 * 	<ColorSwatchPicker.Swatch value="#3b82f6" aria-label={t("color.blue")} defaultChecked />
 * 	<ColorSwatchPicker.Swatch value="#22c55e" aria-label={t("color.green")} />
 * </ColorSwatchPicker>
 * @example
 * <ColorSwatchPicker aria-label={t("form.brandColor.label")}>
 * 	<ColorSwatchPicker.Swatch value="#f97316" aria-label={t("color.orange")} shape="circle" size="lg" />
 * 	<ColorSwatchPicker.Swatch value="#a855f7" aria-label={t("color.purple")} shape="circle" size="lg" />
 * </ColorSwatchPicker>
 */
export function ColorSwatchPicker(
	handle: Handle<ColorSwatchPicker.Props, ColorSwatchPicker.Context>,
) {
	return () => {
		let { name, mix, ...rest } = handle.props;
		let resolvedName = name ?? handle.id;

		handle.context.set({ name: resolvedName });

		return (
			<div {...rest} mix={[attrs({ role: DEFAULT_ROLE }), hstack({ gap: 2 }), flexWrap(), mix]} />
		);
	};
}

/**
 * Renders a single option: a native `<label>` pairing a visually hidden
 * `<input type="radio">` with a {@link ColorSwatch} indicator painted from
 * `value`. The hidden input carries every accessibility and form semantic
 * natively — focus, keyboard selection, native validation, form submission —
 * while the indicator reads the input's own `:checked` and `:focus-visible`
 * states through sibling selectors to render its selection ring and focus
 * ring, and the label reads the input's `:disabled` state through `:has()`
 * to dim itself, with no tracked state of its own. The ring pairs a border
 * color change with an actual boundary the ring itself draws, so selection
 * still reads clearly no matter which color the indicator happens to paint.
 *
 * The indicator stays a purely decorative preview — its own accessible name
 * comes from `aria-label` on the input, exactly the pairing
 * {@link ColorSwatch}'s own documentation anticipates — so every option
 * announces its color correctly regardless of what's painted underneath.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the option's markup.
 * @example
 * <ColorSwatchPicker.Swatch value="#ef4444" aria-label={t("color.red")} />
 * @example
 * <ColorSwatchPicker.Swatch value="#3b82f6" aria-label={t("color.blue")} defaultChecked shape="circle" />
 * @example
 * <ColorSwatchPicker.Swatch value="#22c55e" aria-label={t("color.green")} disabled />
 */
ColorSwatchPicker.Swatch = function ColorSwatchPickerSwatch(
	handle: Handle<ColorSwatchPicker.SwatchProps>,
) {
	return () => {
		let {
			value,
			"aria-label": ariaLabel,
			name,
			shape,
			size,
			checked,
			defaultChecked,
			disabled,
			required,
			parts,
			mix,
			...rest
		} = handle.props;
		let context = handle.context.get(ColorSwatchPicker);
		let resolvedName = name ?? context.name;

		return (
			<label
				{...rest}
				mix={[
					inlineFlex(),
					cursor("default"),
					when("&:has(input:disabled)", [cursor("not-allowed"), opacity(50)]),
					mix,
				]}
			>
				<input
					type="radio"
					id={handle.id}
					value={value}
					name={resolvedName}
					checked={checked}
					defaultChecked={defaultChecked}
					disabled={disabled}
					required={required}
					aria-label={ariaLabel}
					mix={[visuallyHidden(), parts?.input]}
				/>
				<ColorSwatch
					value={value}
					shape={shape}
					size={size}
					mix={[
						transition("border-color, box-shadow"),
						// `precededBy()` rather than a bare `when("input:checked ~ &", …)`:
						// the style serializer only recognizes a key as a nested selector
						// when it starts with `&`, `@`, `:`, `[` or `.`, so an element-first
						// selector is emitted as a *declaration* and the selected state
						// silently never reaches the browser. `precededBy()` leads with
						// `:is(...)`, which is recognized, and `:is()` carries its
						// argument's specificity so matching is unchanged.
						precededBy("input:checked", border("brand.solid")),
						precededBy("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						precededBy("input:checked", ringShadow("brand")),
						parts?.indicator,
					]}
				/>
			</label>
		);
	};
};
