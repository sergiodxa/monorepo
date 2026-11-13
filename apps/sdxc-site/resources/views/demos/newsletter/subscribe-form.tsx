/**
 * Undercurrent's sign-up: one address field and one button, posted as a plain form to an
 * example endpoint that returns the reader to the page, so it works before any script and
 * with none at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { flexCol, flexRow, items } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { Button, TextField } from "@sdxc/ui";
import { landingCtaChrome } from "@sdxc/ui/styles";

namespace SubscribeForm {
	/** The button that names what the reader signs up for. */
	export interface Props {
		/** The button's words. */
		label: string;
	}
}

/**
 * Renders the field and its button on one row from the `sm` container and stacked on a
 * phone, so the address and the action read as one step at any width.
 *
 * @param handle Runtime handle carrying the button label.
 * @returns The render function producing the form.
 */
export default function SubscribeForm(handle: Handle<SubscribeForm.Props>) {
	return () => (
		<form
			method="post"
			action="/examples/newsletter/subscribe"
			data-slot="undercurrent-subscribe"
			mix={[raw({ inlineSize: "100%" })]}
		>
			<div
				mix={[
					combine([
						flexCol(),
						raw({ display: "flex", gap: "0.75rem" }),
						at("sm", [flexRow(), items("end")]),
					]),
				]}
			>
				<TextField
					label="Email address"
					type="email"
					name="email"
					autoComplete="email"
					placeholder="you@example.com"
					required
					mix={[raw({ flex: "1" })]}
				/>
				<Button type="submit" color="brand" mix={[landingCtaChrome()]}>
					{handle.props.label}
				</Button>
			</div>
		</form>
	);
}
