/**
 * Shared "click to submit/navigate" button styling — solid/outline/ghost variants
 * across primary/neutral/danger colors and sm/md/lg sizes, matching `@pkg/ui`'s
 * `Button` API (`color`/`variant`/`size`). Exists so every submit, secondary, and
 * destructive button shares one definition instead of each view hand-rolling the
 * same `css({...})` block, as most views did before this component existed. Use
 * {@link LinkButton} for an `<a>` styled the same way; leave tabs, popover
 * triggers, and other non-submit affordances alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as ElementProps } from "remix/ui";

import { css } from "remix/ui";

import { danger, neutral, primary } from "~/resources/theme";

export type ButtonColor = "primary" | "neutral" | "danger";
export type ButtonVariant = "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

namespace Button {
	export interface Props extends ElementProps<"button"> {
		color?: ButtonColor;
		variant?: ButtonVariant;
		size?: ButtonSize;
	}
}

/** Shared box model every variant/size builds on; kept separate so `LinkButton` reuses it verbatim. */
export const buttonBase = css({
	/**
	 * Without this, a `<button>` keeps the browser's native control chrome
	 * (`appearance: auto`) layered underneath our own border/background, which
	 * on Chromium/macOS renders as a thick embossed ring around the button —
	 * exactly the oversized border (and buttons visually fusing together with
	 * no apparent gap) reported live.
	 */
	appearance: "none",
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: 6,
	borderRadius: 6,
	fontFamily: "inherit",
	fontWeight: 500,
	textDecoration: "none",
	cursor: "pointer",
	"&:disabled": { cursor: "not-allowed", opacity: 0.5 },
	"&:focus-visible": { outline: `2px solid ${primary[600]}`, outlineOffset: 2 },
});

export const buttonSizeMix: Record<ButtonSize, ReturnType<typeof css>> = {
	sm: css({ padding: "6px 12px", fontSize: "0.75rem" }),
	md: css({ padding: "8px 16px", fontSize: "0.875rem" }),
	lg: css({ padding: "10px 20px", fontSize: "1rem" }),
};

const solid: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: "1px solid transparent",
		background: primary[600],
		color: "#ffffff",
		"&:hover": { background: `color-mix(in srgb, ${primary[600]} 85%, black)` },
	}),
	neutral: css({
		border: "1px solid transparent",
		background: neutral[900],
		color: "#ffffff",
		"&:hover": { background: neutral[800] },
	}),
	danger: css({
		border: "1px solid transparent",
		background: danger[600],
		color: "#ffffff",
		"&:hover": { background: danger[700] },
	}),
};

const outline: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: `2px solid ${primary[600]}`,
		background: "transparent",
		color: primary[600],
		"&:hover": { background: `color-mix(in srgb, ${primary[600]} 10%, transparent)` },
		"@media (prefers-color-scheme: dark)": {
			borderColor: primary[400],
			color: primary[400],
			"&:hover": { background: `color-mix(in srgb, ${primary[400]} 16%, transparent)` },
		},
	}),
	neutral: css({
		border: `2px solid ${neutral[300]}`,
		background: "#ffffff",
		color: neutral[500],
		"&:hover": { background: neutral[50] },
	}),
	danger: css({
		border: `2px solid ${danger[600]}`,
		background: "transparent",
		color: danger[600],
		"&:hover": { background: `color-mix(in srgb, ${danger[600]} 10%, transparent)` },
	}),
};

const ghost: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: "1px solid transparent",
		background: "transparent",
		color: primary[600],
		"&:hover": { background: `color-mix(in srgb, ${primary[600]} 10%, transparent)` },
		"@media (prefers-color-scheme: dark)": {
			color: primary[400],
			"&:hover": { background: `color-mix(in srgb, ${primary[400]} 16%, transparent)` },
		},
	}),
	neutral: css({
		border: "1px solid transparent",
		background: "transparent",
		color: neutral[500],
		"&:hover": { background: neutral[100] },
		"@media (prefers-color-scheme: dark)": {
			color: neutral[400],
			"&:hover": { background: neutral[800] },
		},
	}),
	danger: css({
		border: "1px solid transparent",
		background: "transparent",
		color: danger[600],
		"&:hover": { background: `color-mix(in srgb, ${danger[600]} 10%, transparent)` },
	}),
};

export const buttonVariantMix: Record<
	ButtonVariant,
	Record<ButtonColor, ReturnType<typeof css>>
> = {
	solid,
	outline,
	ghost,
};

/** Renders a `<button>` in one of nine color/variant combinations, at one of three sizes. */
export default function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color = "neutral", variant = "solid", size = "md", mix = [], ...rest } = handle.props;

		return (
			<button
				{...rest}
				mix={[buttonBase, buttonSizeMix[size], buttonVariantMix[variant][color], ...mix]}
			/>
		);
	};
}
