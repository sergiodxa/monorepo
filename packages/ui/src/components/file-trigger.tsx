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

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { cursor, userSelect } from "@sdxc/u/general";
import { gap, inlineFlex, items, justify } from "@sdxc/u/layout";
import { pb, pi } from "@sdxc/u/size";
import { active, data, hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
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
	 * attribute applies unchanged except `type` (fixed `"file"`), `role` (not
	 * overridable on a file input), and `size` (repurposed for visual size).
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
		 * wraps the host `<input>` — an icon, text, or both, kept decorative so
		 * the platform's label-to-control association reaches the input on click.
		 */
		children?: RemixNode;
		/** Per-part styling for this component's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="file">` wrapped in a `<label>` styled
 * through this library's shared `data-color`/`data-variant`/`data-size`
 * contract; in dev mode, content lacking an accessible name logs a warning.
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
