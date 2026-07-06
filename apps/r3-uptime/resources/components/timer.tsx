/**
 * Interactive Counter client component for the r3-uptime UI. Registered as a remix/ui
 * client entry, it renders increment and decrement buttons around a live count and
 * calls handle.update to re-render on each click. It exists as a demonstration of
 * client-side interactivity and hydration in the app's rendering stack.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";
import { Button } from "remix/ui/button";

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
