/**
 * The search dialog's key hints: a quiet line under its surfaces naming the keys the box
 * answers to, one key cap per key, so a reader finds the keyboard path without guessing.
 * A touch screen has none of those keys, so the line hides there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { flex, flexWrap, gap, hidden, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Keyboard } from "@sdxc/ui";

import { searchSurfaceMotion } from "~/resources/components/search-surface";

/** Each hint: the keys, each drawn as its own cap with its spoken name, and what they do. */
const KEY_HINTS: ReadonlyArray<{
	keys: ReadonlyArray<{ glyph: string; name: string }>;
	action: string;
}> = [
	{
		keys: [
			{ glyph: "↑", name: "Up arrow" },
			{ glyph: "↓", name: "Down arrow" },
		],
		action: "navigate",
	},
	{ keys: [{ glyph: "↵", name: "Enter" }], action: "open" },
	{ keys: [{ glyph: "esc", name: "Escape" }], action: "close" },
];

/** Where the hints hide: a phone-wide screen, or one driven by touch alone. */
const TOUCH_QUERY = "(max-width: 29.9375rem), (hover: none) and (pointer: coarse)";

/**
 * Renders the hints centred under the dialog's surfaces, arriving and leaving with them.
 * Each cap names its key for assistive technology, which reads the glyph poorly.
 */
export function SearchKeyHints(_handle: Handle) {
	return () => (
		<ul
			aria-label="Keyboard shortcuts"
			mix={[
				m(0),
				p(0),
				listStyle("none"),
				flex(),
				flexWrap(),
				justify("center"),
				gap(4),
				shrink(0),
				text("xs"),
				fg("neutral.muted"),
				searchSurfaceMotion(),
				media(TOUCH_QUERY, hidden()),
			]}
		>
			{KEY_HINTS.map((hint) => (
				<li key={hint.action} mix={[inlineFlex(), items("center"), gap(1)]}>
					{hint.keys.map((key) => (
						<Keyboard key={key.glyph} aria-label={key.name}>
							{key.glyph}
						</Keyboard>
					))}
					<span mix={[inlineFlex(), items("center")]}>{hint.action}</span>
				</li>
			))}
		</ul>
	);
}
