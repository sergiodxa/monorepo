/**
 * Every toast a Tuppence redirect can name. Each says what happened in a few past-tense
 * words, and freezing a card offers Undo in place of asking first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoApp } from "~/resources/views/demo-apps";

import { CARDS, POTS, actionHref } from "./data";
import { SPLIT_LIMIT } from "./state";

/** The toasts, keyed by what a redirect carries. */
export const TOASTS: DemoApp["toasts"] = Object.fromEntries([
	[
		"reset",
		{ color: "neutral", title: "Demo reset", description: "Every change you made is gone." },
	],
	["category-saved", { color: "neutral", title: "Category changed" }],
	["note-saved", { color: "neutral", title: "Note saved" }],
	["note-removed", { color: "neutral", title: "Note removed" }],
	["split-removed", { color: "neutral", title: "Split removed" }],
	...Array.from({ length: SPLIT_LIMIT - 1 }, (_, index) => [
		`split-${index + 2}`,
		{
			color: "neutral",
			title: `Split ${index + 2} ways`,
			description: "In a real bank, the others would get a request to pay.",
		},
	]),
	["budget-saved", { color: "neutral", title: "Budget saved" }],
	[
		"budget-invalid",
		{ color: "danger", title: "Budget not saved", description: "Enter an amount above zero." },
	],
	...CARDS.flatMap((card) => [
		[
			`frozen-${card.id}`,
			{
				color: "neutral",
				title: `${card.name} frozen`,
				action: {
					label: "Undo",
					form: { action: actionHref(`cards/${card.id}/freeze`), fields: { frozen: "false" } },
				},
			},
		],
		[
			`unfrozen-${card.id}`,
			{
				color: "neutral",
				title: `${card.name} unfrozen`,
				action: {
					label: "Undo",
					form: { action: actionHref(`cards/${card.id}/freeze`), fields: { frozen: "true" } },
				},
			},
		],
	]),
	...POTS.flatMap((pot) => [
		[`moved-in-${pot.id}`, { color: "success", title: `Added to ${pot.name}` }],
		[`moved-out-${pot.id}`, { color: "neutral", title: `Withdrawn from ${pot.name}` }],
	]),
]);
