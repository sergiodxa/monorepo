/**
 * A labeled color field building on {@link ColorField} for its plain
 * fallback, extended with a {@link ColorPicker.Group} trigger row and a
 * {@link ColorPicker.Trigger} swatch button for composing a
 * {@link ColorPicker.Dialog} — a Popover-hosted picking surface — alongside
 * it. Composing {@link ColorPicker.Group} and {@link ColorPicker.Dialog} as
 * children swaps in that richer trigger-and-panel layout in place of the
 * plain fallback field; leaving `children` unset keeps the fallback on its
 * own, a complete, keyboard-operable control with no composed surface at
 * all.
 *
 * A picking surface typically composes a two-dimensional saturation/
 * brightness area, a hue wheel, an alpha slider, and a color field for direct
 * entry — optionally alongside a preset swatch row — every part reading and
 * reporting the same live color. None of those parts share state with one
 * another on their own: each renders from whatever value its own props
 * describe, and each reports a settled gesture through its own dispatched
 * event or native form submission. Wiring those reports back into every
 * other part's next render is the consuming island's own job, the same way
 * {@link ColorPicker.Dialog}'s doc comment walks through in full.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { attrs, css } from "remix/ui";

import { focusRingPrimary } from "../styles/focus-ring";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { ColorField } from "./color-field";
import { ColorSwatch } from "./color-swatch";
import { Popover } from "./popover";

/**
 * Native `<button>` `type` {@link ColorPicker.Trigger} falls back to when a
 * consumer doesn't supply one, keeping a click on the trigger from
 * submitting a surrounding `<form>` the way a bare `<button>`'s default type
 * otherwise would.
 */
const DEFAULT_BUTTON_TYPE: NonNullable<ColorPicker.TriggerProps["type"]> = "button";

/**
 * Shape variant {@link ColorPicker.Trigger} falls back to when `shape` is
 * omitted, mirroring {@link ColorSwatch}'s own default so a trigger left
 * unstyled reads the same as a bare swatch.
 */
const DEFAULT_TRIGGER_SHAPE: ColorSwatch.Shape = "rounded";

/**
 * `role` applied to {@link ColorPicker.Dialog}'s host through {@link attrs}
 * unless a consumer supplies its own `role`, identifying the surface as a
 * non-modal dialog layered above the page rather than a full-screen modal.
 */
const DEFAULT_DIALOG_ROLE = "dialog";

/**
 * Side of the trigger {@link ColorPicker.Dialog} renders against when
 * `placement` is left unset, reading down and start-ward the way a dropdown
 * conventionally does.
 */
const DEFAULT_DIALOG_PLACEMENT: Popover.Placement = "bottom-start";

/**
 * Prop types for {@link ColorPicker} and its compound parts.
 */
export namespace ColorPicker {
	/**
	 * Semantic color role for the fallback field's keyboard focus ring,
	 * mirroring {@link ColorField.Color}. Read only by the fallback field —
	 * {@link ColorPicker.Group}'s composed control carries no `color` prop of
	 * its own, since it's rendered directly by the consumer.
	 */
	export type Color = ColorField.Color;

	/**
	 * Every prop {@link ColorField.PartsProps} accepts, unchanged. Applies only
	 * to the fallback field's internally composed label, control, preview,
	 * description, and error — the composed layout styles its own parts
	 * individually through {@link ColorPicker.Group}, {@link ColorPicker.Trigger},
	 * and {@link ColorPicker.Dialog} instead.
	 */
	export interface PartsProps extends ColorField.PartsProps {}

	/**
	 * Props accepted by {@link ColorPicker}. Leaving `children` unset renders
	 * {@link ColorField}'s own plain fallback field, using every field below;
	 * composing {@link ColorPicker.Group} and {@link ColorPicker.Dialog} instead
	 * renders the richer trigger-and-panel layout, and every field below goes
	 * unread — build the fallback's caption, supporting copy, and validation
	 * message directly into that composed layout instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the fallback field's focus ring. Read only when `children` is unset. */
		color?: Color;
		/** The fallback field's caption, rendered through {@link ColorField}. Read only when `children` is unset. */
		label?: RemixNode;
		/** Supporting copy beneath the fallback field. Read only when `children` is unset. */
		description?: RemixNode;
		/** Validation message beneath the fallback field. Read only when `children` is unset. */
		errorMessage?: RemixNode;
		/** Notation the fallback field's typed entry is constrained to. Read only when `children` is unset. */
		format?: ColorField.Format;
		/** Native `name` submitted with an enclosing form, read only by the fallback field. */
		name?: string;
		/** Current value, as a literal color string, for a fallback field a consumer tracks itself. */
		value?: string;
		/** Initial value, as a literal color string, for a fallback field left to the platform's own uncontrolled state. */
		defaultValue?: string;
		/** Placeholder copy shown while the fallback field is empty. */
		placeholder?: string;
		/** Marks the fallback field required for its enclosing form. */
		required?: boolean;
		/** Marks the fallback field inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the fallback field's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint for the fallback field. */
		autoComplete?: string;
		/** Per-part styling for the fallback field's internally composed parts. Read only when `children` is unset. */
		parts?: PartsProps;
		/**
		 * The trigger-and-panel layout — typically a `Label`,
		 * {@link ColorPicker.Group} (housing the field's own control and
		 * {@link ColorPicker.Trigger}), and {@link ColorPicker.Dialog} (housing a
		 * picking surface) — rendered in place of {@link ColorField}'s plain
		 * fallback. Leaving this unset renders that fallback instead, every field
		 * above passed straight through to it unchanged.
		 */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes the field's own control — an `Input`, styled the
	 * same way {@link ColorField}'s own control is — and
	 * {@link ColorPicker.Trigger} into one visual row.
	 */
	export interface GroupProps extends TagProps<"div"> {}

	/**
	 * Every native `<button>` attribute except `children`, which stays fixed to
	 * this button's own {@link ColorSwatch}, plus the `mix` passthrough. `type`
	 * defaults to {@link DEFAULT_BUTTON_TYPE}. Point `commandfor` at
	 * {@link ColorPicker.Dialog}'s `id` with `command="toggle-popover"` to wire
	 * this control up as the surface's invoker.
	 */
	export interface TriggerProps extends Omit<TagProps<"button">, "children"> {
		/**
		 * The color this trigger previews, already resolved to a literal CSS
		 * color value — the same value its inner {@link ColorSwatch} paints.
		 * Required, since a trigger with nothing to preview has no reason to
		 * render.
		 */
		value: string;
		/** Shape variant for the inner {@link ColorSwatch}, mirrored onto the button host so its own corners match. Defaults to {@link DEFAULT_TRIGGER_SHAPE}. */
		shape?: ColorSwatch.Shape;
	}

	/**
	 * Every prop {@link Popover.Props} accepts, since {@link ColorPicker.Dialog}
	 * renders one directly as its host. `placement` defaults to
	 * {@link DEFAULT_DIALOG_PLACEMENT} rather than {@link Popover}'s own
	 * default.
	 */
	export interface DialogProps extends Popover.Props {}
}

/**
 * Renders {@link ColorPicker}'s root. Leaving `children` unset renders
 * {@link ColorField}'s own plain fallback field — a complete, labeled,
 * keyboard-operable color-notation control with a live swatch preview —
 * passing `color`, `label`, `description`, `errorMessage`, `format`, `name`,
 * `value`/`defaultValue`, `placeholder`, `required`, `disabled`, `readOnly`,
 * `autoComplete`, and `parts` straight through to it unchanged. Composing
 * {@link ColorPicker.Group} and {@link ColorPicker.Dialog} as `children`
 * instead — typically alongside a `Label` and the field's own supporting copy
 * or validation message, built directly into that composition — renders the
 * richer trigger-and-panel layout in a single column with a small gap between
 * its parts, and every field above goes unread.
 *
 * In dev mode, falling back to {@link ColorField}'s plain field with no
 * `label` set logs a `console.warn`, mirroring {@link ColorField}'s own
 * accessible-name requirement.
 *
 * @param handle Runtime handle carrying the root element's props.
 * @returns The render function producing the color picker's markup.
 * @example
 * <ColorPicker label={t("form.accentColor.label")} name="accentColor" defaultValue="#3b82f6" />
 * @example
 * <ColorPicker>
 * 	<Label htmlFor="brandColor">{t("form.brandColor.label")}</Label>
 * 	<ColorPicker.Group>
 * 		<Input id="brandColor" type="text" name="brandColor" defaultValue="#3b82f6" />
 * 		<ColorPicker.Trigger
 * 			commandfor="brandColor-panel"
 * 			command="toggle-popover"
 * 			aria-label={t("form.brandColor.toggle")}
 * 			value="#3b82f6"
 * 		/>
 * 	</ColorPicker.Group>
 * 	<ColorPicker.Dialog id="brandColor-panel">
 * 		{...the picking surface — see ColorPicker.Dialog's own doc comment}
 * 	</ColorPicker.Dialog>
 * </ColorPicker>
 */
export function ColorPicker(handle: Handle<ColorPicker.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage,
			format,
			name,
			value,
			defaultValue,
			placeholder,
			required,
			disabled,
			readOnly,
			autoComplete,
			parts,
			children,
			mix,
			...rest
		} = handle.props;

		if (import.meta.env.DEV && !children && !label) {
			console.warn(
				'ColorPicker: falling back to ColorField\'s plain color-notation field needs a "label" describing what it collects for assistive technology.',
			);
		}

		if (!children) {
			return (
				<ColorField
					{...rest}
					color={color}
					label={label}
					description={description}
					errorMessage={errorMessage}
					format={format}
					name={name}
					value={value}
					defaultValue={defaultValue}
					placeholder={placeholder}
					required={required}
					disabled={disabled}
					readOnly={readOnly}
					autoComplete={autoComplete}
					parts={parts}
					mix={mix}
				/>
			);
		}

		return (
			<div
				{...rest}
				data-slot="color-picker"
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
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
 * Renders {@link ColorPicker}'s control row: a plain flex host laying the
 * field's own control and {@link ColorPicker.Trigger} out side by side. The
 * whole row gains a keyboard focus ring the moment focus lands anywhere
 * inside it — on the control itself, since the trigger button sits outside
 * the tab stop a plain `:focus` would catch — rather than waiting for the
 * button specifically.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <ColorPicker.Group>
 * 	<Input id="brandColor" type="text" name="brandColor" defaultValue="#3b82f6" />
 * 	<ColorPicker.Trigger
 * 		commandfor="brandColor-panel"
 * 		command="toggle-popover"
 * 		aria-label={t("form.brandColor.toggle")}
 * 		value="#3b82f6"
 * 	/>
 * </ColorPicker.Group>
 */
ColorPicker.Group = function ColorPickerGroup(handle: Handle<ColorPicker.GroupProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					focusRingPrimary({ when: "&:focus-within" }),
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link ColorPicker}'s trailing trigger: a native `<button>` housing
 * a {@link ColorSwatch} sized to fill it completely, so the whole button reads
 * as a live preview of the color it opens a picking surface for rather than a
 * separate preview-plus-icon pairing. The button's own corners follow `shape`
 * (defaulting to {@link DEFAULT_TRIGGER_SHAPE}), mirrored onto the swatch
 * inside it, so both stay the same outline. Hover reads this host's own
 * native `:hover` pseudo-class, and a keyboard focus-visible ring reads in the
 * semantic primary tone. This control carries no click behavior of its own —
 * point `commandfor` at {@link ColorPicker.Dialog}'s `id` with
 * `command="toggle-popover"` to wire it up as that surface's invoker, which
 * both opens the surface and becomes its implicit CSS anchor with no script
 * of this module's own.
 *
 * In dev mode, a button with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name to announce for it — the inner {@link ColorSwatch} paints a color with
 * no text alternative of its own.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <ColorPicker.Trigger
 * 	commandfor="brandColor-panel"
 * 	command="toggle-popover"
 * 	aria-label={t("form.brandColor.toggle")}
 * 	value="#3b82f6"
 * />
 */
ColorPicker.Trigger = function ColorPickerTrigger(handle: Handle<ColorPicker.TriggerProps>) {
	return () => {
		let { type, value, shape, mix, ...rest } = handle.props;
		let resolvedType = type ?? DEFAULT_BUTTON_TYPE;
		let resolvedShape = shape ?? DEFAULT_TRIGGER_SHAPE;

		warnIfNoAccessibleLabel(
			handle.props,
			"ColorPicker.Trigger: this button needs an `aria-label` describing what it does — its content is a color preview with no accessible name of its own.",
		);

		return (
			<button
				type={resolvedType}
				{...rest}
				data-slot="trigger"
				data-shape={resolvedShape}
				mix={[
					focusRingPrimary(),
					css({
						position: "relative",
						display: "inline-flex",
						flexShrink: 0,
						padding: "0",
						inlineSize: "var(--ui-color-picker-trigger-size, 2.25rem)",
						blockSize: "var(--ui-color-picker-trigger-size, 2.25rem)",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						cursor: "pointer",
						transitionProperty: "box-shadow",
						transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
						transitionDuration: "150ms",

						'&[data-shape="square"]': {
							borderRadius: "0",
						},
						'&[data-shape="circle"]': {
							borderRadius: "var(--ui-radius-full, 9999px)",
						},

						"&:hover": {
							boxShadow: "0 0 0 2px var(--ui-neutral-border)",
						},
						"&:disabled": {
							cursor: "not-allowed",
							opacity: 0.5,
						},

						"@media (prefers-reduced-motion: reduce)": {
							transitionDuration: "0s",
						},
					}),
					mix,
				]}
			>
				<ColorSwatch
					value={value}
					shape={resolvedShape}
					mix={css({
						inlineSize: "100%",
						blockSize: "100%",
					})}
				/>
			</button>
		);
	};
};

/**
 * Renders {@link ColorPicker}'s picking surface: a Popover whose `placement`
 * defaults to reading down and start-ward from its invoker, padded around
 * whatever picking controls a consumer composes as `children`, laid out in a
 * single column with a gap between them. `role` defaults to `"dialog"`.
 *
 * Opening and closing ride the Popover API exactly as `Popover` documents —
 * {@link ColorPicker.Trigger}'s `commandfor`/`command="toggle-popover"` both
 * shows this surface and, by that same invoker relationship, becomes its
 * implicit CSS anchor, with no positioning logic running in script.
 *
 * A typical composition inside this surface stacks a two-dimensional
 * saturation/brightness area (paired with its own drag mixin so a pointer
 * moves both axes as one gesture), a hue wheel (paired with its own drag
 * mixin so a pointer's angle around its center drives the hue value), an
 * alpha slider, a color field for direct notated entry, and, optionally, a
 * preset swatch row. Every one of those parts renders from its own value
 * props and reports a settled gesture through its own dispatched event or
 * native form submission — none of them read one another directly. Sharing
 * one live color across all of them, so dragging the area updates the wheel's
 * ring marker's own hue-tinted border, the field's typed notation, and the
 * trigger's own preview together, is the consuming island's job: it listens
 * for each part's change event, and re-renders every other part with the
 * settled value, the same way any hydrated island owns state a purely
 * server-rendered composition never tracks on its own.
 *
 * @param handle Runtime handle carrying the host's `Popover` props.
 * @returns The render function producing the surface's markup.
 * @example
 * <ColorPicker.Dialog id="brandColor-panel">
 * 	<ColorArea aria-label={t("colorPicker.area")} hue={hue} defaultSaturation={saturation} defaultValue={brightness} mix={colorAreaDrag()}>
 * 		<ColorArea.SaturationThumb data-color-area-axis="x" aria-label={t("colorPicker.saturation")} />
 * 		<ColorArea.ValueThumb data-color-area-axis="y" aria-label={t("colorPicker.brightness")} />
 * 	</ColorArea>
 * 	<ColorWheel aria-label={t("colorPicker.hue")} defaultValue={hue} mix={colorWheelDrag()} />
 * 	<ColorSlider channel="alpha" defaultValue={alpha}>
 * 		<ColorSlider.Track hue={hue}>
 * 			<ColorSlider.Thumb aria-label={t("colorPicker.alpha")} />
 * 		</ColorSlider.Track>
 * 	</ColorSlider>
 * 	<ColorField label={t("colorPicker.hex")} format="hex" defaultValue="#3b82f6" mix={colorPreview()} />
 * 	<ColorSwatchPicker aria-label={t("colorPicker.presets")}>
 * 		<ColorSwatchPicker.Swatch value="#ef4444" aria-label={t("color.red")} />
 * 		<ColorSwatchPicker.Swatch value="#3b82f6" aria-label={t("color.blue")} defaultChecked />
 * 	</ColorSwatchPicker>
 * </ColorPicker.Dialog>
 */
ColorPicker.Dialog = function ColorPickerDialog(handle: Handle<ColorPicker.DialogProps>) {
	return () => {
		let { placement, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_DIALOG_PLACEMENT;

		return (
			<Popover
				{...rest}
				placement={resolvedPlacement}
				mix={[
					attrs({ role: DEFAULT_DIALOG_ROLE }),
					css({
						display: "flex",
						flexDirection: "column",
						gap: "1rem",
						padding: "1rem",
						outline: "none",
					}),
					mix,
				]}
			>
				{children}
			</Popover>
		);
	};
};
