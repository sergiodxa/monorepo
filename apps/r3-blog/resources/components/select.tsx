import type { Props } from "remix/component";

import { css } from "remix/component";

/**
 * Creates a styled `<select>` component that applies the app's neutral form-control
 * tokens while preserving caller-provided props and additional `mix` styles.
 */
export function Select() {
	return ({ children, mix, ...rest }: Props<"select">) => {
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
