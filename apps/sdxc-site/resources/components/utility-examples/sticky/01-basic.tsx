/**
 * The opening `sticky` example: a scrolling contact list whose letter headings stick to
 * the top until the next one pushes them away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { insBs, sticky } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { bs, is, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Section headings stick to the top of the scroller while their section is in view. */
export default {
	title: "Basic example",
	description:
		"Use `sticky()` with an offset like `insBs(0)` to keep an element in view while its section scrolls. Scroll the list to see it:",
	render: () => (
		<div mix={[overflow("auto"), is(72), bs(64), demo.frame()]}>
			{[
				{ letter: "A", names: ["Ada Lovelace", "Alan Turing", "Anita Borg"] },
				{ letter: "B", names: ["Barbara Liskov", "Brian Kernighan", "Bjarne Stroustrup"] },
				{ letter: "D", names: ["Dennis Ritchie", "Donald Knuth", "Dorothy Vaughan"] },
				{ letter: "G", names: ["Grace Hopper", "Guido van Rossum", "Gordon Moore"] },
			].map((group) => (
				<section>
					<div mix={[sticky(), insBs(0), demo.block()]}>{group.letter}</div>
					{group.names.map((name) => (
						<div mix={[p(3, 4)]}>{name}</div>
					))}
				</section>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
