import type { Props } from "remix/component";

import { css } from "remix/component";

/**
 * Creates a styled input component that applies the blog UI baseline input styles,
 * then preserves and appends any caller-provided `mix` styles.
 */
export function Input() {
	return ({ mix, ...rest }: Props<"input">) => {
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
