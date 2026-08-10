/**
 * A pressable surface that opens the platform's file picker, backed by a
 * native `<input type="file">` wrapped in a `<label>` so the platform itself
 * handles the trigger-to-picker wiring. Its visible content renders inside
 * the same label as a button-like surface, colored, weighted, and sized
 * through the same semantic contract as this library's other pressable
 * controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, userSelect } from "@pkg/u/general";
import { gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { active, data, hover, when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { hasAccessibleText } from "../utils/has-accessible-text";

/** Semantic color role {@link FileTrigger} falls back to when `color` is omitted. */
const DEFAULT_COLOR: FileTrigger.Color = "neutral";

/** Visual weight {@link FileTrigger} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: FileTrigger.Variant = "solid";

/** Size variant {@link FileTrigger} falls back to when `size` is omitted. */
const DEFAULT_SIZE: FileTrigger.Size = "md";

/**
 * Prop types for {@link FileTrigger}.
 */
export namespace FileTrigger {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Visual weight the trigger renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the trigger's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Per-part styling for the elements this component composes besides its
	 * own host `<input>`.
	 */
	export interface PartsProps {
		/** Styling for the `<label>` rendering as the trigger's visible, pressable surface. */
		trigger?: TagProps<"label">["mix"];
	}

	/**
	 * Props accepted by {@link FileTrigger}. Every native `<input type="file">`
	 * attribute is available unchanged, aside from `type`, `role`, and `size`
	 * — `type` is always `"file"`, the platform allows no `role` override on a
	 * file input, and `size` is repurposed for the trigger's visual size
	 * variant instead of the native character-width attribute. `accept` and
	 * `multiple` carry their native meaning: a comma-separated list of
	 * accepted MIME types or extensions, and whether more than one file may
	 * be chosen. `capture` carries its native meaning too, requesting a
	 * specific camera where a mobile browser's picker offers one.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role" | "size"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/**
		 * Switches the picker from choosing individual files to choosing whole
		 * directories, carrying every file nested inside the chosen directory.
		 */
		acceptDirectory?: boolean;
		/**
		 * The trigger's visible content, rendered inside the same `<label>` that
		 * wraps the host `<input>` — an icon, text, or both. Keep it to
		 * decorative content rather than another interactive control: the
		 * platform's label-to-control association is what opens the picker with
		 * no script involved, and nesting another focusable control inside the
		 * label would intercept that click before it ever reaches the input.
		 */
		children?: RemixNode;
		/** Per-part styling for this component's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="file">` wrapped in a `<label>`, colored and
 * shaped through the label's own `data-color`, `data-variant`, and
 * `data-size` attribute contract, exactly mirroring this library's other
 * pressable controls: `"solid"` fills the label with the color's solid
 * background and on-solid foreground, `"outline"` renders a strong colored
 * border over a transparent fill, and `"ghost"` renders just the colored
 * label until hovered or pressed.
 *
 * The input itself stays visually hidden through a clip technique rather
 * than `display: none`, so it remains reachable in the tab order and keeps
 * responding to its own native keyboard activation. Hover and pressed states
 * read directly off the label, which the pointer actually lands on, while
 * the focus-visible ring and disabled dimming read the input's own
 * `:focus-visible` and `:disabled` states through a `:has()` query, since
 * the input — not the label — is the element that actually gets focused and
 * disabled. Clicking anywhere in the label, including its visible content,
 * activates the input through the platform's own label-to-control
 * association, opening the file picker with no script involved.
 *
 * Setting `acceptDirectory` switches the picker to choosing whole
 * directories instead of individual files.
 *
 * In dev mode, a trigger whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <FileTrigger name="avatar" accept="image/png, image/jpeg">
 * 	{t("profile.chooseFile")}
 * </FileTrigger>
 * @example
 * <FileTrigger name="attachments" multiple color="brand" variant="outline">
 * 	{t("thread.attachFiles")}
 * </FileTrigger>
 * @example
 * <FileTrigger name="folder" acceptDirectory aria-label={t("importer.chooseFolder")} />
 */
export function FileTrigger(handle: Handle<FileTrigger.Props>) {
	return () => {
		let { color, variant, size, acceptDirectory, children, parts, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;

		if (
			import.meta.env.DEV &&
			!handle.props["aria-label"] &&
			!handle.props["aria-labelledby"] &&
			!hasAccessibleText(children)
		) {
			console.warn(
				"FileTrigger: a trigger with no visible label text needs an `aria-label` describing what it opens — assistive technology has no accessible name to announce otherwise.",
			);
		}

		return (
			<label
				data-slot="trigger"
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				mix={[
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					gap(2),
					rounded("md"),
					weight("medium"),
					when("&:has(input:focus-visible)", [
						outline({ color: "brand.ring", offset: 2 }),
						data("color", "neutral", outline("neutral.ring")),
						data("color", "success", outline("success.ring")),
						data("color", "warning", outline("warning.ring")),
						data("color", "danger", outline("danger.ring")),
					]),
					when("&:has(input:disabled)", [opacity(50), cursor("not-allowed")]),
					cursor("default"),
					userSelect(),
					pi("1rem"),
					pb("0.5rem"),
					text("sm"),

					data("size", "sm", [pi("0.75rem"), pb("0.375rem"), text("xs")]),
					data("size", "lg", [pi("1.25rem"), pb("0.625rem"), text("base")]),

					data("variant", "solid", [
						data("color", "brand", [
							bg("brand.solid"),
							fg("brand.onSolid"),
							hover(bg("brand.bg-solid-hover")),
							active(bg("brand.bg-solid-pressed")),
						]),
						data("color", "neutral", [
							bg("neutral.solid"),
							fg("neutral.onSolid"),
							hover(bg("neutral.bg-solid-hover")),
							active(bg("neutral.bg-solid-pressed")),
						]),
						data("color", "success", [
							bg("success.solid"),
							fg("success.onSolid"),
							hover(bg("success.bg-solid-hover")),
							active(bg("success.bg-solid-pressed")),
						]),
						data("color", "warning", [
							bg("warning.solid"),
							fg("warning.onSolid"),
							hover(bg("warning.bg-solid-hover")),
							active(bg("warning.bg-solid-pressed")),
						]),
						data("color", "danger", [
							bg("danger.solid"),
							fg("danger.onSolid"),
							hover(bg("danger.bg-solid-hover")),
							active(bg("danger.bg-solid-pressed")),
						]),
					]),

					data("variant", "outline", [
						border({ width: 2, noStyleDefault: true }),
						bg("transparent"),
						data("color", "brand", [
							border("brand.strong"),
							fg("brand"),
							hover(bg("brand.tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						data("color", "neutral", [
							border("neutral.strong"),
							fg("neutral"),
							hover(bg("neutral.tint")),
							active(bg("neutral.bg-tint-hover")),
						]),
						data("color", "success", [
							border("success.strong"),
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						data("color", "warning", [
							border("warning.strong"),
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						data("color", "danger", [
							border("danger.strong"),
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),

					data("variant", "ghost", [
						bg("transparent"),
						data("color", "brand", [
							fg("brand"),
							hover(bg("brand.tint")),
							active(bg("brand.bg-tint-hover")),
						]),
						data("color", "neutral", [
							fg("neutral"),
							hover(bg("neutral.bg-tint-hover")),
							active(bg("neutral.bg-tint-pressed")),
						]),
						data("color", "success", [
							fg("success"),
							hover(bg("success.tint")),
							active(bg("success.bg-tint-hover")),
						]),
						data("color", "warning", [
							fg("warning"),
							hover(bg("warning.tint")),
							active(bg("warning.bg-tint-hover")),
						]),
						data("color", "danger", [
							fg("danger"),
							hover(bg("danger.tint")),
							active(bg("danger.bg-tint-hover")),
						]),
					]),

					parts?.trigger,
				]}
			>
				{children}
				<input
					type="file"
					{...rest}
					mix={[acceptDirectory && attrs({ webkitdirectory: true }), visuallyHidden(), mix]}
				/>
			</label>
		);
	};
}
