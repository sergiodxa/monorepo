/**
 * A convenience wrapper composing a labeled, described, and validated color
 * field in one call: a caption through {@link Label}, a native
 * `<input type="text">` styled through {@link Input} and constrained through
 * a `pattern` keyed off a chosen notation, a live preview through
 * {@link ColorSwatch} sitting beside the control, an optional supporting
 * passage through {@link Description}, and an optional validation message
 * through {@link FieldError}. Every id and `aria-describedby` relationship
 * between the parts is computed from this instance's own stable identifier,
 * leaving no id bookkeeping to the consumer.
 *
 * The preview reads this instance's own resolved `value` (falling back to
 * `defaultValue`, then to a fully transparent placeholder) directly at render
 * time, so it always matches whatever the control holds on first paint and on
 * every server round-trip, with no script involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { spacer, hstack } from "@pkg/u/layout";
import { minIs } from "@pkg/u/size";

import type { FieldPartsProps } from "../utils/field-parts";

import { fieldStackLayout } from "../styles/field-stack-layout";
import { resolveFieldWiring } from "../utils/resolve-field-wiring";

import { ColorSwatch } from "./color-swatch";
import { Description } from "./description";
import { FieldError } from "./field-error";
import { resolveFieldIssue } from "./form";
import { Input } from "./input";
import { Label } from "./label";

/** Notation {@link ColorField} falls back to when `format` is omitted. */
const DEFAULT_FORMAT: ColorField.Format = "hex";

/**
 * Preview value {@link ColorField} falls back to when neither `value` nor
 * `defaultValue` is set, painting the preview's checkerboard fully rather
 * than a solid color standing in for one the field doesn't hold yet.
 */
const DEFAULT_SWATCH_VALUE = "transparent";

/**
 * Native `pattern` constraint for each supported notation, keyed off
 * {@link ColorField.Format}. Every pattern accepts the notation's short and
 * long forms and its optional alpha channel, and stays permissive on
 * whitespace and the comma-versus-space-separated component list, mirroring
 * the same three notations {@link ColorSwatch}'s own `value` renders directly
 * as a literal CSS color.
 */
const FORMAT_PATTERNS: Record<ColorField.Format, string> = {
	hex: "#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})",
	rgb: "rgba?\\(\\s*\\d{1,3}%?\\s*,?\\s*\\d{1,3}%?\\s*,?\\s*\\d{1,3}%?\\s*([,/]\\s*[0-9.]+%?\\s*)?\\)",
	hsl: "hsla?\\(\\s*-?\\d{1,3}(\\.\\d+)?(deg)?\\s*,?\\s*\\d{1,3}(\\.\\d+)?%\\s*,?\\s*\\d{1,3}(\\.\\d+)?%\\s*([,/]\\s*[0-9.]+%?\\s*)?\\)",
};

/**
 * Prop types for {@link ColorField}.
 */
export namespace ColorField {
	/**
	 * Semantic color role for the control's keyboard focus ring, each mapped
	 * to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Notation the control's typed value is constrained to through its native
	 * `pattern`: `"hex"` for `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, `"rgb"` for
	 * `rgb()`/`rgba()` functional notation, and `"hsl"` for `hsl()`/`hsla()`
	 * functional notation.
	 */
	export type Format = "hex" | "rgb" | "hsl";

	/**
	 * Per-part styling for the elements this convenience wrapper composes in
	 * one call, layered after each part's own built-in styling.
	 */
	export interface PartsProps extends FieldPartsProps {
		/** Styling for the row grouping the control and its preview. */
		control?: TagProps<"div">["mix"];
		/** Styling for the live preview, rendered through {@link ColorSwatch}. */
		swatch?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link ColorField}. `mix` styles the root element
	 * grouping the field's parts; style the composed label, control, preview,
	 * description, and error individually through `parts` instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Semantic color role for the control's focus ring. Defaults to `"neutral"` when omitted. */
		color?: Color;
		/**
		 * The field's caption, rendered through {@link Label} and associated
		 * with the control through a native `for`/`id` relationship computed
		 * from this instance's own identifier.
		 */
		label: RemixNode;
		/**
		 * Supporting copy rendered through {@link Description} beneath the
		 * control and referenced by the control's `aria-describedby`. Omit to
		 * render no description.
		 */
		description?: RemixNode;
		/**
		 * Validation message rendered through {@link FieldError} beneath the
		 * control — after the description, when both are present — and
		 * referenced by the control's `aria-describedby`. Its presence alone
		 * marks the control's `aria-invalid`, unless `aria-invalid` is set
		 * explicitly.
		 *
		 * Optional inside a {@link Form} carrying `issues`: the field then
		 * finds its own message by `name` through form context, and an
		 * explicit value here still wins over whatever context holds.
		 */
		errorMessage?: RemixNode;
		/**
		 * Native `autofocus`. Defaults to `true` for the first invalid field
		 * of an enclosing {@link Form}'s `issues`, so a server round-trip
		 * lands keyboard focus on the first problem with no client
		 * JavaScript; pass it explicitly to decide for this field yourself.
		 */
		autoFocus?: boolean;
		/**
		 * Notation the control's `pattern` constrains typed entry to. Defaults
		 * to {@link DEFAULT_FORMAT}.
		 */
		format?: Format;
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/**
		 * Current value, as a literal color string in `format`'s notation, for a
		 * control a consumer tracks itself. This same string paints the
		 * preview directly.
		 */
		value?: string;
		/**
		 * Initial value, as a literal color string in `format`'s notation, for a
		 * control left to the platform's own uncontrolled state. This same
		 * string paints the preview directly whenever `value` is unset.
		 */
		defaultValue?: string;
		/** Placeholder copy shown while the control is empty. */
		placeholder?: string;
		/** Marks the control required for its enclosing form. */
		required?: boolean;
		/** Marks the control inert and excluded from the tab order. */
		disabled?: boolean;
		/** Marks the control's value fixed, while keeping it focusable and included in form submission. */
		readOnly?: boolean;
		/** Native autofill hint. */
		autoComplete?: string;
		/** Per-part styling for this wrapper's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a complete color field in one call: a root element stacking
 * {@link Label}, a row pairing an {@link Input} control with a
 * {@link ColorSwatch} preview, and, when supplied, {@link Description} and
 * {@link FieldError} in a single column with a small gap between them. The
 * label's `for`, the control's `id`, and the control's `aria-describedby` are
 * all computed from this instance's own stable identifier, so the parts stay
 * correctly associated with no id bookkeeping left to the consumer.
 *
 * The control is a native `<input type="text">` whose `pattern` is keyed off
 * `format` (defaulting to {@link DEFAULT_FORMAT}): `"hex"` accepts the
 * `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` notation, `"rgb"` accepts `rgb()`/
 * `rgba()` functional notation, and `"hsl"` accepts `hsl()`/`hsla()`
 * functional notation, in every case tolerating the notation's comma- or
 * space-separated component list and its optional alpha channel. The
 * platform's own typed-entry validation and post-interaction `:user-invalid`
 * state enforce that constraint the same way any other `pattern`-bearing
 * `<input>` would.
 *
 * The paired {@link ColorSwatch} reads this instance's own resolved `value`
 * (falling back to `defaultValue`, then to a fully transparent placeholder
 * when neither is set) directly as its literal color value — every supported
 * notation is already a valid literal CSS color string, so the preview needs
 * no parsing or conversion to paint correctly on first paint and on every
 * server round-trip, with no script involved.
 *
 * The control's keyboard focus ring reads `color` (defaulting to
 * `"neutral"`), and an invalid state — driven by `errorMessage`'s
 * presence, or an explicit `aria-invalid` override — recolors both the border
 * and ring to the semantic danger tone regardless of `color`; see
 * {@link Input} for the rest of the control's own styling contract. Composing
 * {@link Label}, {@link Input}, {@link ColorSwatch}, {@link Description}, and
 * {@link FieldError} directly instead remains available for a field whose
 * wiring or layout this wrapper doesn't cover.
 *
 * Inside a {@link Form} carrying `issues`, the field needs no `errorMessage`
 * of its own: it looks its message up by `name` through form context, and the
 * first invalid field of that render also picks up `autofocus`, so a parse
 * failure re-rendered from the server both shows every message and lands
 * keyboard focus on the first one. An explicit `errorMessage` still wins.
 *
 * @param handle Runtime handle carrying the root element's props and this instance's stable identifier.
 * @returns The render function producing the field's markup.
 * @example
 * <ColorField label={t("form.accentColor.label")} name="accentColor" defaultValue="#3b82f6" />
 * @example
 * <ColorField
 * 	label={t("form.brandColor.label")}
 * 	name="brandColor"
 * 	format="rgb"
 * 	defaultValue="rgb(16, 185, 129)"
 * 	description={t("form.brandColor.hint")}
 * />
 * @example
 * <ColorField
 * 	label={t("form.themeColor.label")}
 * 	name="themeColor"
 * 	format="hsl"
 * 	value="hsl(210, 90%, 55%)"
 * 	errorMessage={t("form.themeColor.invalid")}
 * />
 */
export function ColorField(handle: Handle<ColorField.Props>) {
	return () => {
		let {
			color,
			label,
			description,
			errorMessage: errorMessageProp,
			autoFocus,
			format,
			name,
			value,
			defaultValue,
			placeholder,
			required,
			disabled,
			readOnly,
			autoComplete,
			"aria-invalid": ariaInvalidProp,
			parts,
			mix,
			...rest
		} = handle.props;
		let { errorMessage, isFirstInvalid } = resolveFieldIssue(handle, name, errorMessageProp);
		let resolvedAutoFocus = autoFocus ?? (isFirstInvalid || undefined);
		let { resolvedColor, resolvedInvalid, descriptionId, errorId, describedBy } =
			resolveFieldWiring(handle.id, {
				color,
				errorMessage,
				description,
				ariaInvalid: ariaInvalidProp,
			});
		let resolvedFormat = format ?? DEFAULT_FORMAT;
		let resolvedSwatchValue = value ?? defaultValue ?? DEFAULT_SWATCH_VALUE;

		return (
			<div {...rest} data-slot="color-field" mix={[fieldStackLayout(), mix]}>
				<Label htmlFor={handle.id} mix={parts?.label}>
					{label}
				</Label>
				<div data-slot="control" mix={[hstack({ gap: 2, align: "center" }), parts?.control]}>
					<Input
						id={handle.id}
						type="text"
						name={name}
						value={value}
						defaultValue={defaultValue}
						placeholder={placeholder}
						pattern={FORMAT_PATTERNS[resolvedFormat]}
						required={required}
						disabled={disabled}
						readOnly={readOnly}
						autoComplete={autoComplete}
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- Not a focus grab on page load: this only ever resolves true for the first field an enclosing Form reports as invalid, so a failed submit lands the user on the problem instead of leaving them to hunt for it.
						autoFocus={resolvedAutoFocus}
						aria-invalid={resolvedInvalid}
						aria-describedby={describedBy}
						color={resolvedColor}
						mix={[spacer(), minIs(0), parts?.input]}
					/>
					<ColorSwatch value={resolvedSwatchValue} size="lg" mix={parts?.swatch} />
				</div>
				{description ? (
					<Description id={descriptionId} mix={parts?.description}>
						{description}
					</Description>
				) : null}
				{errorMessage ? (
					<FieldError id={errorId} mix={parts?.error}>
						{errorMessage}
					</FieldError>
				) : null}
			</div>
		);
	};
}
