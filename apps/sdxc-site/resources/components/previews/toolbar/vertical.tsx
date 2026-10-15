/**
 * Live example for a `Toolbar` running down a column. `aria-orientation="vertical"` flips
 * both the layout and what assistive technology announces, and each icon-only button
 * carries the `aria-label` that names it, so the example is plain server markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BoldIcon, ItalicIcon, UnderlineIcon } from "@sdxc/icons";
import { Button, Toolbar } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Toolbar aria-label="Text style" aria-orientation="vertical">
	<Button variant="ghost" aria-label="Bold">
		<BoldIcon />
	</Button>
	<Button variant="ghost" aria-label="Italic">
		<ItalicIcon />
	</Button>
	<Button variant="ghost" aria-label="Underline">
		<UnderlineIcon />
	</Button>
</Toolbar>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Vertical",
	code: CODE,
	render: () => (
		<Toolbar aria-label="Text style" aria-orientation="vertical">
			<Button variant="ghost" aria-label="Bold">
				<BoldIcon />
			</Button>
			<Button variant="ghost" aria-label="Italic">
				<ItalicIcon />
			</Button>
			<Button variant="ghost" aria-label="Underline">
				<UnderlineIcon />
			</Button>
		</Toolbar>
	),
};
