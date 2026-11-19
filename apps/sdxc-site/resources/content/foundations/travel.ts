/**
 * The Foundations of `@sdxc/ui/travel`: what its booking pieces are for, the rules they share
 * (prices and times arrive formatted, choices are form fields), and the variables they read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const TRAVEL: Foundations = {
	module: "travel",
	slug: "travel-foundations",
	title: "Travel foundations",
	summary:
		"What @sdxc/ui/travel is for, the forms-first rules its booking pieces share, and the variables they read.",
	importPath: "@sdxc/ui/travel",
	source: "ui/src/travel/price-breakdown.tsx",
	intro: [
		"The pieces of booking a trip: what a stay costs and what guests said about it, and the flights, seats, fares and passes of getting there.",
		"Every choice is a form field and every price or time arrives already formatted, so a booking flow posts without script and reads in the visitor's own locale.",
	],
	reachFor: [
		"A booking card whose price breakdown follows the dates and guests.",
		"Reviews summarised as a score with star and category bars.",
		"A flight search, its fare classes, a seat map and the boarding pass at the end.",
	],
	ideas: [
		{
			title: "Formatted by the caller",
			body: "Amounts, times and durations are strings or nodes you pass, so currency and locale stay yours.",
		},
		{
			title: "Named outputs",
			body: "A price line with `name` wraps its amount in an `<output>`, so an island can update it in place.",
		},
		{
			title: "Choices are inputs",
			body: "Fare classes and seats are radio inputs, so the form posts the pick with script off.",
		},
	],
	roles:
		"Reads the neutral role for text and hairlines, success for discounts and cheap days, and brand for picks.",
	variables: [
		{
			title: "Shared",
			lead: "The travel pieces read the theme's own tokens; none is declared for them alone.",
			variables: [
				{
					name: "--ui-radius-lg",
					default: "0.75rem",
					controls: "The corner of cards and fare options.",
				},
				{
					name: "--ui-color-success-600",
					default: "the success scale",
					controls: "Discount lines and the cheapest days.",
				},
			],
		},
	],
};

export default TRAVEL;
