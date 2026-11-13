/**
 * Undercurrent's sign-up: one address field and one button, posted as a plain form to an
 * example endpoint that returns the reader to the page at the form's own confirmation, so it
 * works before any script and with none at all.
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
import { css } from "remix/component";

namespace SubscribeForm {
	/** The button that names what the reader signs up for. */
	export interface Props {
		/** The button's words. */
		label: string;
		/**
		 * The page-unique id of the form's confirmation. The form posts to an address ending in
		 * it, and the redirect back keeps that fragment, so the note shows under this form.
		 */
		confirmation: string;
	}
}

/**
 * Renders the field and its button on one row from the `sm` container and stacked on a
 * phone, so the address and the action read as one step at any width, with the confirmation
 * under them, shown once the address ends in its id.
 *
 * @param handle Runtime handle carrying the button label.
 * @returns The render function producing the form.
 */
export default function SubscribeForm(handle: Handle<SubscribeForm.Props>) {
	return () => (
		<form
			method="post"
			action={`/examples/newsletter/subscribe#${handle.props.confirmation}`}
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
			<p
				id={handle.props.confirmation}
				role="status"
				data-slot="undercurrent-subscribed"
				mix={css({
					display: "none",
					margin: "0.75rem 0 0",
					padding: "0.75rem 1rem",
					borderInlineStart: "3px solid var(--ui-brand-fg)",
					backgroundColor: "var(--ui-neutral-bg-tint)",
					color: "var(--ui-neutral-fg-emphasis)",
					fontSize: "0.875rem",
					scrollMarginBlock: "6rem",
					"&:target": { display: "block" },
				})}
			>
				You're on the list: the next letter arrives Thursday at 7 a.m. (This is a demo, so no
				address was stored.)
			</p>
		</form>
	);
}
