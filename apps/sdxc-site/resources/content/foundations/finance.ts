/**
 * The Foundations of `@sdxc/ui/finance`: what its money pieces are for, the minor-unit and
 * masked-number rules they share, and the variables they read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const FINANCE: Foundations = {
	module: "finance",
	slug: "finance-foundations",
	title: "Finance foundations",
	summary:
		"What @sdxc/ui/finance is for, the money rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/finance",
	source: "ui/src/finance/ledger.tsx",
	intro: [
		"The pieces of a banking, budgeting or wallet screen: a statement grouped by day with each day's total, and a drawn payment card that can be frozen.",
		"They draw what the server hands them. Amounts come in as integer minor units and are written by the root `Amount`, so a figure is never a float.",
	],
	reachFor: [
		"A bank or card statement, a wallet's history or a billing log that reads by day.",
		"A cards screen where a card is shown, frozen or picked.",
		"Any list of money in and out where the incoming side should read at a glance.",
	],
	ideas: [
		{
			title: "Minor units in, text out",
			body: "Pass cents and an ISO code to `Amount`; `@sdxc/money` parses, splits and converts them.",
		},
		{
			title: "A statement's sign",
			body: '`sign="ledger"` marks money in with a plus and the success tone, and money out as a plain figure.',
		},
		{
			title: "Rows are links",
			body: "With `href`, a `Ledger.Entry` is one link, so the record opens beside the list from its address.",
		},
		{
			title: "Masked numbers only",
			body: "`PaymentCard` takes the last four digits and draws the rest as dots, so a full number is never passed.",
		},
		{
			title: "State in the name",
			body: "A frozen card frosts over and its accessible name says frozen.",
		},
	],
	roles:
		"Reads the neutral role for text, hairlines and the day headings, brand for the open row and the card face, and success for money in.",
	variables: [
		{
			title: "Ledger",
			variables: [
				{
					name: "--ui-ledger-bg",
					default: "var(--ui-bg)",
					controls:
						"The sticky day heading's background; set it to the surface the ledger sits on.",
				},
				{
					name: "--ui-ledger-sticky-top",
					default: "0px",
					controls: "Where the day heading sticks, below a sticky toolbar.",
				},
				{
					name: "--ui-ledger-inset",
					default: "0.75rem",
					controls: "The inline padding of the heading and every row.",
				},
			],
		},
		{
			title: "PaymentCard",
			variables: [
				{
					name: "--ui-payment-card-bg",
					default: "the tone's gradient",
					controls: "The face's paint, for a card in an issuer's own colours.",
				},
				{
					name: "--ui-payment-card-radius",
					default: "1rem",
					controls: "The card's corners.",
				},
				{
					name: "--ui-payment-card-max",
					default: "26rem",
					controls: "The widest the card grows.",
				},
			],
		},
	],
};

export default FINANCE;
