/**
 * A pricing plan's buy button, as a form that posts the chosen package to the example
 * checkout. The endpoint returns the reader to this page, so trying a plan never leaves it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { grid } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";

namespace CheckoutButton {
	/** Which package the button buys, and how prominent it is. */
	export interface Props {
		/** The package id the checkout receives. */
		plan: "book" | "complete";
		/** The featured plan's button is the brand colour; the others are surface buttons. */
		featured?: boolean;
		children: RemixNode;
	}
}

/**
 * Renders the form as a grid, so the button stretches across the plan's foot like the
 * card's other rows.
 *
 * @param handle Runtime handle carrying the package and label.
 * @returns The render function producing the form.
 */
export default function CheckoutButton(handle: Handle<CheckoutButton.Props>) {
	return () => {
		let { children, featured, plan } = handle.props;

		return (
			<form method="post" action="/examples/book/checkout" mix={[grid()]}>
				<input type="hidden" name="package" value={plan} />
				<Button
					type="submit"
					color={featured ? "brand" : "neutral"}
					variant={featured ? undefined : "surface"}
				>
					{children}
				</Button>
			</form>
		);
	};
}
