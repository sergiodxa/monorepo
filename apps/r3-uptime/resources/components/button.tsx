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

import type { Handle, Props as TagProps } from "remix/ui";

import { Button as UIButton } from "@pkg/r3-ui";
import { css } from "remix/ui";

export type ButtonColor = "primary" | "neutral" | "danger";
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
export const buttonBase = css({
	appearance: "none",
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "0.5rem",
	borderRadius: "var(--ui-radius-md, 0.375rem)",
	fontFamily: "inherit",
	fontWeight: 500,
	textDecoration: "none",
	cursor: "pointer",
	"&:disabled": { cursor: "not-allowed", opacity: 0.5 },
	"&:focus-visible": {
		outline: "2px solid var(--ui-primary-ring)",
		outlineOffset: 2,
	},
});

export const buttonSizeMix: Record<ButtonSize, ReturnType<typeof css>> = {
	sm: css({ paddingInline: "0.75rem", paddingBlock: "0.375rem", fontSize: "0.75rem" }),
	md: css({ paddingInline: "1rem", paddingBlock: "0.5rem", fontSize: "0.875rem" }),
	lg: css({ paddingInline: "1.25rem", paddingBlock: "0.625rem", fontSize: "1rem" }),
};

const solid: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: "1px solid transparent",
		background: "var(--ui-primary-bg-solid)",
		color: "var(--ui-primary-fg-on-solid)",
		"&:hover": { background: "var(--ui-primary-bg-solid-hover)" },
		"&:active": { background: "var(--ui-primary-bg-solid-pressed)" },
	}),
	neutral: css({
		border: "1px solid transparent",
		background: "var(--ui-neutral-bg-solid)",
		color: "var(--ui-neutral-fg-on-solid)",
		"&:hover": { background: "var(--ui-neutral-bg-solid-hover)" },
		"&:active": { background: "var(--ui-neutral-bg-solid-pressed)" },
	}),
	danger: css({
		border: "1px solid transparent",
		background: "var(--ui-danger-bg-solid)",
		color: "var(--ui-danger-fg-on-solid)",
		"&:hover": { background: "var(--ui-danger-bg-solid-hover)" },
		"&:active": { background: "var(--ui-danger-bg-solid-pressed)" },
	}),
};

const outline: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: "2px solid var(--ui-primary-border-strong)",
		background: "transparent",
		color: "var(--ui-primary-fg)",
		"&:hover": { background: "var(--ui-primary-bg-tint)" },
		"&:active": { background: "var(--ui-primary-bg-tint-hover)" },
	}),
	neutral: css({
		border: "2px solid var(--ui-neutral-border-strong)",
		background: "transparent",
		color: "var(--ui-neutral-fg)",
		"&:hover": { background: "var(--ui-neutral-bg-tint)" },
		"&:active": { background: "var(--ui-neutral-bg-tint-hover)" },
	}),
	danger: css({
		border: "2px solid var(--ui-danger-border-strong)",
		background: "transparent",
		color: "var(--ui-danger-fg)",
		"&:hover": { background: "var(--ui-danger-bg-tint)" },
		"&:active": { background: "var(--ui-danger-bg-tint-hover)" },
	}),
};

const ghost: Record<ButtonColor, ReturnType<typeof css>> = {
	primary: css({
		border: "1px solid transparent",
		background: "transparent",
		color: "var(--ui-primary-fg)",
		"&:hover": { background: "var(--ui-primary-bg-tint)" },
		"&:active": { background: "var(--ui-primary-bg-tint-hover)" },
	}),
	neutral: css({
		border: "1px solid transparent",
		background: "transparent",
		color: "var(--ui-neutral-fg)",
		"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
		"&:active": { background: "var(--ui-neutral-bg-tint-pressed)" },
	}),
	danger: css({
		border: "1px solid transparent",
		background: "transparent",
		color: "var(--ui-danger-fg)",
		"&:hover": { background: "var(--ui-danger-bg-tint)" },
		"&:active": { background: "var(--ui-danger-bg-tint-hover)" },
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

/** Renders a `<button>` in one of nine color/variant combinations, at one of three sizes, through `@pkg/r3-ui`'s `Button`. */
export default function Button(handle: Handle<Button.Props>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;

		return <UIButton {...rest} color={color} variant={variant} size={size} mix={mix} />;
	};
}
