/**
 * The Foundations of `@sdxc/ui/commerce`: what its ordering pieces are for, the forms-first
 * and server-priced rules they share, and the data attributes their islands read and write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const COMMERCE: Foundations = {
	module: "commerce",
	slug: "commerce-foundations",
	title: "Commerce foundations",
	summary:
		"What @sdxc/ui/commerce is for, the forms-first rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/commerce",
	source: "ui/src/commerce/item-options-dialog.tsx",
	intro: [
		"The pieces of ordering something to be delivered: a menu item and the dialog that asks for its options, priced option groups, cart lines with a quantity stepper, and an order's live status.",
		"Every piece is a form or a link first, so a cart fills and an order places with script off; the islands only reprice and track live.",
	],
	reachFor: [
		"A food delivery, grocery or takeaway menu whose items ask for picks with prices.",
		"A cart whose counts change with one tap, and still post without script.",
		"An order, delivery or job whose progress streams from the server while the visitor watches.",
	],
	ideas: [
		{
			title: "Forms first",
			body: "Steppers, picks and Place order are plain posts; the server prices and checks them.",
		},
		{
			title: "Prices in minor units",
			body: "Every choice carries `data-price` in cents; `OptionsLive` sums them with the form's `data-base`.",
		},
		{
			title: "Native dialogs",
			body: "A menu card opens its `<dialog>` with `commandfor`; it is a bottom sheet on a phone.",
		},
		{
			title: "Limits on the form",
			body: "A required group is radios; extras are checkboxes that stop at `max` once script loads.",
		},
		{
			title: "Progress as text",
			body: "`OrderLive` reads `<step> <progress> <minutes>` lines from any `text/plain` stream.",
		},
		{
			title: "Maps by attribute",
			body: "The tracker moves any `[data-map-marker]` on the page, so it pairs with a map without importing one.",
		},
	],
	roles:
		"Reads the neutral role for text, hairlines and surfaces, and brand for the add button, ticked picks and the steps already done.",
	variables: [
		{
			title: "Shared",
			lead: "The commerce pieces read the theme's own tokens; none is declared for them alone.",
			variables: [
				{
					name: "--ui-radius-lg",
					default: "1rem",
					controls: "The corner of a menu item card.",
				},
				{
					name: "--ui-color-brand-600",
					default: "the brand scale",
					controls: "Ticked picks, the done steps' dots and rail, and the current step's ring.",
				},
				{
					name: "--ui-map-progress",
					default: "set by OrderLive",
					controls: "Written on each `[data-map-marker]` as the order moves, from 0 to 1.",
				},
			],
		},
	],
};

export default COMMERCE;
