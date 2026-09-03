/**
 * A labeled color field composing {@link ColorField}'s plain fallback with
 * an optional {@link ColorPicker.Group} trigger row and
 * {@link ColorPicker.Dialog} picking surface swapped in via `children`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { outline } from "@sdxc/u/color";
import { opacity, rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { hstack, inlineFlex, relative, shrink, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { attrs } from "remix/ui";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { ColorField } from "./color-field";
import { ColorSwatch } from "./color-swatch";
import { Popover } from "./popover";

/**
 * Native `<button>` `type` {@link ColorPicker.Trigger} falls back to,
 * keeping an omitted `type` from implicitly submitting an enclosing
 * `<form>` the way a bare `<button>` would.
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
	 * mirroring {@link ColorField.Color}. The composed layout carries no
	 * `color` prop of its own, since a consumer renders it directly.
	 */
	export type Color = ColorField.Color;

	/**
	 * Every prop {@link ColorField.PartsProps} accepts, unchanged, applied
	 * only to the fallback field's internally composed parts — the composed
	 * layout styles its own parts individually instead.
	 */
	export interface PartsProps extends ColorField.PartsProps {}

	/**
	 * Props accepted by {@link ColorPicker}. Leaving `children` unset renders
	 * {@link ColorField}'s plain fallback using every field below; composing
	 * {@link ColorPicker.Group} and {@link ColorPicker.Dialog} instead skips them.
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
		 * {@link ColorPicker.Group}, and {@link ColorPicker.Dialog} — rendered in
		 * place of {@link ColorField}'s plain fallback. Unset renders that fallback.
		 */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `children` composes the field's own control and
	 * {@link ColorPicker.Trigger} into one visual row.
	 */
	export interface GroupProps extends TagProps<"div"> {}

	/**
	 * Every native `<button>` attribute except `children`, fixed to this
	 * button's own {@link ColorSwatch}. Point `commandfor` at
	 * {@link ColorPicker.Dialog}'s `id` with `command="toggle-popover"` to wire it up.
	 */
	export interface TriggerProps extends Omit<TagProps<"button">, "children"> {
		/**
		 * The color this trigger previews, already resolved to a literal CSS
		 * color value — the same value its inner {@link ColorSwatch} paints.
		 * Required, since a trigger with nothing to preview has no reason to render.
		 */
		value: string;
		/** Shape variant for the inner {@link ColorSwatch}, mirrored onto the button host so its own corners match. Defaults to {@link DEFAULT_TRIGGER_SHAPE}. */
		shape?: ColorSwatch.Shape;
	}

	/**
	 * Every prop {@link Popover.Props} accepts, since {@link ColorPicker.Dialog}
	 * renders one directly as its host. `placement` defaults to
	 * {@link DEFAULT_DIALOG_PLACEMENT}.
	 */
	export interface DialogProps extends Popover.Props {}
}

/**
 * Renders {@link ColorPicker}'s root: {@link ColorField}'s plain fallback
 * when `children` is unset, or the trigger-and-panel layout composed from
 * {@link ColorPicker.Group} and {@link ColorPicker.Dialog} otherwise.
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
			<div {...rest} data-slot="color-picker" mix={[vstack({ gap: 1 }), mix]}>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link ColorPicker}'s control row: a plain flex host laying the
 * field's own control and {@link ColorPicker.Trigger} side by side, with a
 * keyboard focus ring on the whole row the moment focus lands anywhere inside.
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
					when("&:focus-within", outline({ color: "brand.ring", offset: 2 })),
					hstack({ gap: 2, align: "center" }),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link ColorPicker}'s trailing trigger: a `<button>` housing a
 * {@link ColorSwatch} that fills it as a live preview, wired via
 * `commandfor`/`command="toggle-popover"` to {@link ColorPicker.Dialog}'s `id`.
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
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					relative(),
					inlineFlex(),
					is("var(--ui-color-picker-trigger-size, 2.25rem)"),
					bs("var(--ui-color-picker-trigger-size, 2.25rem)"),
					rounded("md"),
					cursor("pointer"),
					transition("box-shadow"),
					when('&[data-shape="circle"]', rounded("full")),
					when("&:disabled", [cursor("not-allowed"), opacity(50)]),
					p(0),
					shrink(),
					when('&[data-shape="square"]', rounded("none")),
					when("&:hover", raw({ boxShadow: "0 0 0 2px var(--ui-neutral-border)" })),
					media("(prefers-reduced-motion: reduce)", raw({ transitionDuration: "0s" })),
					mix,
				]}
			>
				<ColorSwatch value={value} shape={resolvedShape} mix={[is("full"), bs("full")]} />
			</button>
		);
	};
};

/**
 * Renders {@link ColorPicker}'s picking surface: a Popover, defaulting
 * `placement` to bottom-start and `role` to `"dialog"`, padding whatever
 * picking controls a consumer composes as `children` in a single column.
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
					vstack({ gap: 4 }),
					p(4),
					raw({ outline: "none" }),
					mix,
				]}
			>
				{children}
			</Popover>
		);
	};
};
