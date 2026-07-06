/**
 * Reusable Button UI component for r3-blog. Renders a native `<button>` styled
 * with the app's accent design tokens (colors, radius, sizing) and merges any
 * caller-supplied `mix` styles, giving a consistent primary button across views.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props } from "remix/ui";

import { css } from "remix/ui";

/**
 * Creates a styled button component that applies the default accent UI tokens
 * and appends any caller-provided `mix` styles.
 */
export function Button(handle: Handle<Props<"button">>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<button
				{...rest}
				mix={[
					css({
						boxSizing: "border-box",
						height: "2.25rem",
						padding: "0 0.7rem",
						fontSize: "0.9rem",
						lineHeight: "1.4",
						fontFamily: "inherit",
						borderRadius: "0.4rem",
						border: "1px solid var(--ui-accent-border)",
						backgroundColor: "var(--ui-accent-bg-tint)",
						color: "var(--ui-accent-fg-emphasis)",
						cursor: "pointer",
					}),
					...(mix ?? []),
				]}
			>
				{children}
			</button>
		);
	};
}
