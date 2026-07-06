/**
 * Reusable Select UI component for r3-blog. Renders a native `<select>` styled with
 * the app's neutral form-control design tokens (sizing, border, colors) and merges
 * caller `mix` styles, keeping dropdowns visually consistent with other form fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props } from "remix/ui";

import { css } from "remix/ui";

/**
 * Creates a styled `<select>` component that applies the app's neutral form-control
 * tokens while preserving caller-provided props and additional `mix` styles.
 */
export function Select(handle: Handle<Props<"select">>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		let baseMix = css({
			boxSizing: "border-box",
			height: "2.25rem",
			padding: "0 0.55rem",
			fontSize: "0.9rem",
			lineHeight: "1.4",
			fontFamily: "inherit",
			borderRadius: "0.4rem",
			border: "1px solid var(--ui-neutral-border)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			color: "var(--ui-neutral-fg-emphasis)",
		}) as unknown as NonNullable<Props<"select">["mix"]>[number];

		return (
			<select {...rest} mix={[baseMix, ...(mix ?? [])]}>
				{children}
			</select>
		);
	};
}
