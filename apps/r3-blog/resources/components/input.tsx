/**
 * Reusable Input UI component for r3-blog. Renders a native `<input>` styled with
 * the app's neutral form-control design tokens (sizing, border, colors) and merges
 * caller `mix` styles, keeping text fields visually consistent across forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props } from "remix/ui";

import { css } from "remix/ui";

/**
 * Creates a styled input component that applies the blog UI baseline input styles,
 * then preserves and appends any caller-provided `mix` styles.
 */
export function Input(handle: Handle<Props<"input">>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<input
				{...rest}
				mix={[
					css({
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
					}),
					...(mix ?? []),
				]}
			/>
		);
	};
}
