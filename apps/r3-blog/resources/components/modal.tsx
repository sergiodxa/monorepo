import type { Props } from "remix/component";

import { css } from "remix/component";

export function Modal() {
	return ({ children, mix, ...rest }: Props<"dialog">) => {
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
