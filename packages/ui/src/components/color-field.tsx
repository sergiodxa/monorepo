/**
 * A labeled, described, and validated color field in one call: every id and
 * `aria-describedby` relationship comes from this instance's own stable
 * identifier, so the composed parts stay associated on their own. The preview
 * paints the resolved value at render time, so it matches the control on
 * first paint and on every server round-trip.
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
 * `defaultValue` is set, painting the preview's checkerboard fully so an
 * empty field reads as empty.
 */
const DEFAULT_SWATCH_VALUE = "transparent";

/**
 * Native `pattern` constraint for each supported notation, keyed off
 * {@link ColorField.Format}. Every pattern accepts the notation's short and
 * long forms, its optional alpha channel, and either component separator.
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
	 * `pattern`: `"hex"` for `#rgb`/`#rrggbb` and their alpha forms, `"rgb"`
	 * for `rgb()`/`rgba()`, and `"hsl"` for `hsl()`/`hsla()`.
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
		 * control and referenced by the control's `aria-describedby`.
		 */
		description?: RemixNode;
		/**
		 * Validation message rendered through {@link FieldError} beneath the
		 * control, referenced by its `aria-describedby`; its presence alone
		 * marks `aria-invalid`. Inside a {@link Form} carrying `issues`, this prop wins.
		 */
		errorMessage?: RemixNode;
		/**
		 * Native `autofocus`. Defaults to `true` for the first invalid field of
		 * an enclosing {@link Form}'s `issues`, so a server round-trip lands
		 * keyboard focus on the first problem while staying script-free.
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
 * Composes {@link Label}, an {@link Input} constrained by `format`'s native
 * `pattern`, a live {@link ColorSwatch} preview of the resolved value, and
 * any {@link Description} or {@link FieldError}, wired to this instance's own id.
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
