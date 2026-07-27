/**
 * Shared "click to submit/navigate" button styling — solid/outline/ghost variants
 * across primary/neutral/danger colors and sm/md/lg sizes, matching `@pkg/ui`'s
 * `Button` API (`color`/`variant`/`size`). Exists so every submit, secondary, and
 * destructive button shares one definition instead of each view hand-rolling the
 * same `css({...})` block, as most views did before this component existed. Use
 * {@link LinkButton} for an `<a>` styled the same way; leave tabs, popover
 * triggers, and other non-submit affordances alone.
 *
 * Internally composes `@pkg/r3-ui`'s own `Button`, restricted to this app's
 * three-color palette (`primary`/`neutral`/`danger` — no `success`/`warning`)
 * so every call site keeps its existing prop shape while picking up r3-ui's
 * `data-color`/`data-variant`/`data-size` styling, focus ring, and (unused
 * here, but now available for free) `isPending` busy state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, MixInput, Props as TagProps } from "remix/ui";

import { Button as UIButton } from "@pkg/r3-ui";
import { bg, border, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { appearance, gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, textDecoration, weight } from "@pkg/u/typography";

export type ButtonColor = "brand" | "neutral" | "danger";
export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

namespace Button {
	export interface Props extends TagProps<"button"> {
		color?: ButtonColor;
		variant?: ButtonVariant;
		size?: ButtonSize;
	}
}

/**
 * Shared box model for a plain `<button>` styled like {@link Button} without
 * going through the component itself — kept only for
 * `resources/components/run-monitor-button.tsx`'s hand-rolled submit button,
 * which composes `buttonBase`/`buttonSizeMix`/`buttonVariantMix` directly onto
 * its own `<button>` instead of rendering {@link Button}. Reimplemented on
 * `@pkg/r3-ui`'s `--ui-*` custom properties so its look stays in sync with
 * {@link Button}'s own r3-ui-backed styling even though the two no longer
 * share an implementation.
 */
export const buttonBase: MixInput = [
	appearance("none", { webkit: false, moz: false }),
	inlineFlex(),
	items("center"),
	justify("center"),
	gap("0.5rem"),
	rounded("md"),
	raw({ fontFamily: "inherit" }),
	weight(500),
	textDecoration("none"),
	cursor("pointer"),
	when("&:disabled", [cursor("not-allowed"), opacity(50)]),
	when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
];

export const buttonSizeMix: Record<ButtonSize, MixInput> = {
	sm: [pi("0.75rem"), pb("0.375rem"), fontSize("xs")],
	md: [pi("1rem"), pb("0.5rem"), fontSize("sm")],
	lg: [pi("1.25rem"), pb("0.625rem"), fontSize("base")],
};

const solid: Record<ButtonColor, MixInput> = {
	brand: [
		border({ color: "transparent", width: 1 }),
		bg("brand.solid"),
		fg("brand.onSolid"),
		when("&:hover", bg("brand.bg-solid-hover")),
		when("&:active", bg("brand.bg-solid-pressed")),
	],
	neutral: [
		border({ color: "transparent", width: 1 }),
		bg("neutral.solid"),
		fg("neutral.onSolid"),
		when("&:hover", bg("neutral.bg-solid-hover")),
		when("&:active", bg("neutral.bg-solid-pressed")),
	],
	danger: [
		border({ color: "transparent", width: 1 }),
		bg("danger.solid"),
		fg("danger.onSolid"),
		when("&:hover", bg("danger.bg-solid-hover")),
		when("&:active", bg("danger.bg-solid-pressed")),
	],
};

const outlineVariant: Record<ButtonColor, MixInput> = {
	brand: [
		border({ color: "brand.strong", width: 2 }),
		bg("transparent"),
		fg("brand"),
		when("&:hover", bg("brand.tint")),
		when("&:active", bg("brand.bg-tint-hover")),
	],
	neutral: [
		border({ color: "neutral.strong", width: 2 }),
		bg("transparent"),
		fg("neutral"),
		when("&:hover", bg("neutral.tint")),
		when("&:active", bg("neutral.bg-tint-hover")),
	],
	danger: [
		border({ color: "danger.strong", width: 2 }),
		bg("transparent"),
		fg("danger"),
		when("&:hover", bg("danger.tint")),
		when("&:active", bg("danger.bg-tint-hover")),
	],
};

const ghost: Record<ButtonColor, MixInput> = {
	brand: [
		border({ color: "transparent", width: 1 }),
		bg("transparent"),
		fg("brand"),
		when("&:hover", bg("brand.tint")),
		when("&:active", bg("brand.bg-tint-hover")),
	],
	neutral: [
		border({ color: "transparent", width: 1 }),
		bg("transparent"),
		fg("neutral"),
		when("&:hover", bg("neutral.bg-tint-hover")),
		when("&:active", bg("neutral.bg-tint-pressed")),
	],
	danger: [
		border({ color: "transparent", width: 1 }),
		bg("transparent"),
		fg("danger"),
		when("&:hover", bg("danger.tint")),
		when("&:active", bg("danger.bg-tint-hover")),
	],
};

export const buttonVariantMix: Record<ButtonVariant, Record<ButtonColor, MixInput>> = {
	solid,
	outline: outlineVariant,
	ghost,
};

/** Renders a `<button>` in one of nine color/variant combinations, at one of three sizes, through `@pkg/r3-ui`'s `Button`. */
export default function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;

		return <UIButton {...rest} color={color} variant={variant} size={size} mix={mix} />;
	};
}
