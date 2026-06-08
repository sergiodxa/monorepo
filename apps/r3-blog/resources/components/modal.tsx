import type { Handle, Props } from "remix/ui";

import { css } from "remix/ui";

/**
 * Creates a dialog component with the blog modal shell styles and merges caller `mix` overrides.
 */
export function Modal(handle: Handle<Props<"dialog">>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<dialog
				{...rest}
				mix={[
					css({
						maxWidth: "28rem",
						width: "100%",
						textAlign: "left",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.7rem",
						padding: "1.2rem",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						color: "var(--ui-neutral-fg-emphasis)",
						"::backdrop": { backgroundColor: "oklch(0 0 0 / 0.4)" },
					}),
					...(mix ?? []),
				]}
			>
				{children}
			</dialog>
		);
	};
}
