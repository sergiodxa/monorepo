import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";
import { Button } from "remix/ui/button";

/**
 * Renders a hydrated counter to validate client entry wiring.
 */
export const Counter = clientEntry(
	"/resources/components/timer.tsx#Counter",
	function Counter(handle: Handle) {
		let count = 0;

		return () => (
			<div mix={[css({ display: "flex", gap: 8, alignItems: "center" })]}>
				<Button
					tone="secondary"
					mix={[
						on("click", () => {
							count--;
							handle.update();
						}),
					]}
				>
					Decrement Counter
				</Button>

				<span mix={[css({ fontVariant: "tabular-nums" })]}>Counter: {count}</span>

				<Button
					tone="primary"
					mix={[
						on("click", () => {
							count++;
							handle.update();
						}),
					]}
				>
					Increment Counter
				</Button>
			</div>
		);
	},
);
