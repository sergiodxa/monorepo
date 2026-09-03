/**
 * An interactive control for a single, immediate action — submitting a form,
 * triggering a command, opening a dialog. Its host renders as a native
 * `<button>` shaped by a semantic color role, a visual weight variant, and a
 * size, and holds its footprint while rendering a busy pending state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { LoaderCircleIcon } from "@pkg/icons";
import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded, visibility } from "@pkg/u/effects";
import { cursor, userSelect } from "@pkg/u/general";
import {
	absolute,
	flex,
	gap,
	inlineFlex,
	inset,
	items,
	justify,
	relative,
	shrink,
} from "@pkg/u/layout";
import { bs, is, pb, pi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text, weight } from "@pkg/u/typography";

import type { SemanticColor } from "../utils/semantic-color";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

const DEFAULT_COLOR: Button.Color = "neutral";

const DEFAULT_VARIANT: Button.Variant = "solid";

const DEFAULT_SIZE: Button.Size = "md";

/**
 * Native `type` given to a button carrying `command`/`commandfor` and no
 * `type` of its own: the platform treats a button that could also submit as an
 * ambiguous invoker and skips its command, so an invoker needs this type.
 */
const INVOKER_TYPE = "button";

/**
 * Prop types for {@link Button}.
 */
export namespace Button {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Visual weight the button renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the button's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Per-part styling for the elements a pending button renders besides its
	 * own host.
	 */
	export interface PartsProps {
		/** Styling for the decorative rotating glyph shown while pending. */
		spinner?: TagProps<"span">["mix"];
		/**
		 * Styling for the wrapper holding the button's own children while
		 * pending; kept in the layout to preserve the button's footprint, but
		 * hidden from view and from assistive technology.
		 */
		content?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link Button}.
	 */
	export interface Props extends TagProps<"button"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/**
		 * Marks the button busy: merges into the native `disabled` attribute and
		 * swaps the visible content for a spinner glyph while holding the rendered
		 * footprint, so a page mid-request keeps its layout.
		 */
		isPending?: boolean;
		/** Per-part styling for the pending state's internal elements. */
		parts?: PartsProps;
	}
}

/**
 * Visual state lives in `data-color`/`data-variant`/`data-size` on the host, so
 * hover, pressed, and focus-visible stay on native pseudo-classes. `type` precedes
 * the spread so the platform sees it while parsing `command`/`commandfor`.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the button's markup.
 * @example
 * <Button type="submit">{t("actions.save")}</Button>
 * @example
 * <Button color="danger" variant="outline" size="sm">{t("actions.delete")}</Button>
 * @example
 * <Button type="submit" isPending={isSubmitting}>{t("actions.save")}</Button>
 */
export function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color, variant, size, isPending, disabled, type, parts, children, mix, ...rest } =
			handle.props;
		let isInvoker = rest.command !== undefined || rest.commandfor !== undefined;
		let resolvedType = type ?? (isInvoker ? INVOKER_TYPE : undefined);
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let resolvedDisabled = disabled || isPending;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"Button: an icon-only button needs an `aria-label` describing what it does — assistive technology has no accessible text to announce otherwise.",
		);

		return (
			<button
				type={resolvedType}
				{...rest}
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				data-pending={isPending || undefined}
				disabled={resolvedDisabled}
				mix={[
					when("&:focus-visible", [
						outline({ color: "brand.ring", offset: 2 }),
						when('&[data-color="neutral"]', outline("neutral.ring")),
						when('&[data-color="success"]', outline("success.ring")),
						when('&[data-color="warning"]', outline("warning.ring")),
						when('&[data-color="danger"]', outline("danger.ring")),
					]),
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					gap(2),
					/**
					 * An icon keeps the size it was asked for when a narrow row squeezes the
					 * button: the label is what wraps or ellipsizes, since a compressed glyph
					 * reads as a rendering fault.
					 */
					when("& > svg", shrink()),
					rounded("md"),
					weight("medium"),
					cursor("default"),
					userSelect(),

					pi(4),
					pb(2),
					text("sm"),
					/**
					 * Every variant carries the same border width, colored to match its own
					 * fill (transparent for ghost), so solid and ghost render the exact
					 * footprint outline does.
					 */
					border({ width: 2, noStyleDefault: true }),

					when('&[data-size="sm"]', [pi(3), pb(1.5), text("xs")]),
					when('&[data-size="lg"]', [pi(5), pb(2.5), text("base")]),

					when('&[data-variant="solid"]', [
						when('&[data-color="brand"]', [
							bg("brand.solid"),
							border("brand.solid"),
							fg("brand.onSolid"),
							when("&:hover", [bg("brand.bg-solid-hover"), border("brand.bg-solid-hover")]),
							when("&:active", [bg("brand.bg-solid-pressed"), border("brand.bg-solid-pressed")]),
						]),
						when('&[data-color="neutral"]', [
							bg("neutral.solid"),
							border("neutral.solid"),
							fg("neutral.onSolid"),
							when("&:hover", [bg("neutral.bg-solid-hover"), border("neutral.bg-solid-hover")]),
							when("&:active", [
								bg("neutral.bg-solid-pressed"),
								border("neutral.bg-solid-pressed"),
							]),
						]),
						when('&[data-color="success"]', [
							bg("success.solid"),
							border("success.solid"),
							fg("success.onSolid"),
							when("&:hover", [bg("success.bg-solid-hover"), border("success.bg-solid-hover")]),
							when("&:active", [
								bg("success.bg-solid-pressed"),
								border("success.bg-solid-pressed"),
							]),
						]),
						when('&[data-color="warning"]', [
							bg("warning.solid"),
							border("warning.solid"),
							fg("warning.onSolid"),
							when("&:hover", [bg("warning.bg-solid-hover"), border("warning.bg-solid-hover")]),
							when("&:active", [
								bg("warning.bg-solid-pressed"),
								border("warning.bg-solid-pressed"),
							]),
						]),
						when('&[data-color="danger"]', [
							bg("danger.solid"),
							border("danger.solid"),
							fg("danger.onSolid"),
							when("&:hover", [bg("danger.bg-solid-hover"), border("danger.bg-solid-hover")]),
							when("&:active", [bg("danger.bg-solid-pressed"), border("danger.bg-solid-pressed")]),
						]),
					]),

					when('&[data-variant="outline"]', [
						bg("transparent"),
						when('&[data-color="brand"]', [
							border("brand.strong"),
							fg("brand"),
							when("&:hover", bg("brand.tint")),
							when("&:active", bg("brand.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							border("neutral.strong"),
							fg("neutral"),
							when("&:hover", bg("neutral.tint")),
							when("&:active", bg("neutral.bg-tint-hover")),
						]),
						when('&[data-color="success"]', [
							border("success.strong"),
							fg("success"),
							when("&:hover", bg("success.tint")),
							when("&:active", bg("success.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							border("warning.strong"),
							fg("warning"),
							when("&:hover", bg("warning.tint")),
							when("&:active", bg("warning.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							border("danger.strong"),
							fg("danger"),
							when("&:hover", bg("danger.tint")),
							when("&:active", bg("danger.bg-tint-hover")),
						]),
					]),

					when('&[data-variant="ghost"]', [
						bg("transparent"),
						border("transparent"),
						when('&[data-color="brand"]', [
							fg("brand"),
							when("&:hover", bg("brand.tint")),
							when("&:active", bg("brand.bg-tint-hover")),
						]),
						when('&[data-color="neutral"]', [
							fg("neutral"),
							when("&:hover", bg("neutral.bg-tint-hover")),
							when("&:active", bg("neutral.bg-tint-pressed")),
						]),
						when('&[data-color="success"]', [
							fg("success"),
							when("&:hover", bg("success.tint")),
							when("&:active", bg("success.bg-tint-hover")),
						]),
						when('&[data-color="warning"]', [
							fg("warning"),
							when("&:hover", bg("warning.tint")),
							when("&:active", bg("warning.bg-tint-hover")),
						]),
						when('&[data-color="danger"]', [
							fg("danger"),
							when("&:hover", bg("danger.tint")),
							when("&:active", bg("danger.bg-tint-hover")),
						]),
					]),

					when("&:disabled:not([data-pending])", [cursor("not-allowed"), opacity(50)]),

					when("&[data-pending]", [relative(), cursor("wait")]),
					mix,
				]}
			>
				{isPending ? (
					<>
						<span
							aria-hidden="true"
							data-slot="spinner"
							mix={[
								absolute(),
								inset(0),
								flex(),
								items("center"),
								justify("center"),
								when("& svg", [
									is("var(--ui-spinner-icon-size-sm, 1rem)"),
									bs("var(--ui-spinner-icon-size-sm, 1rem)"),
								]),
								when('[data-size="lg"] & svg', [
									is("var(--ui-spinner-icon-size-md, 1.25rem)"),
									bs("var(--ui-spinner-icon-size-md, 1.25rem)"),
								]),
								parts?.spinner,
							]}
						>
							<LoaderCircleIcon />
						</span>
						<span
							data-slot="content"
							mix={[visibility("hidden"), inlineFlex(), items("center"), gap(2), parts?.content]}
						>
							{children}
						</span>
					</>
				) : (
					children
				)}
			</button>
		);
	};
}
