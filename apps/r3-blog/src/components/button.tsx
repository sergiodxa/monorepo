import type { Props } from "remix/component";

export function Button() {
	return ({ css, children, ...rest }: Props<"button">) => {
		return (
			<button
				{...rest}
				css={{
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
					...css,
				}}
			>
				{children}
			</button>
		);
	};
}
