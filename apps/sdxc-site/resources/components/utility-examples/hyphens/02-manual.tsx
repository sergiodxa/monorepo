/**
 * A `hyphens` example in manual mode: a long word carrying soft hyphens, which break and
 * draw a hyphen only at the points the author marked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { hyphens } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A word broken only at the soft hyphens written into it. */
export default {
	title: "Manual hyphenation",
	description:
		'Use `hyphens("manual")` to break words only where you mark them with a soft hyphen (`&shy;`), and `hyphens("none")` to ignore even those:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>hyphens("manual")</p>
				<p lang="de" mix={[hyphens("manual")]}>
					Kraft&shy;fahr&shy;zeug&shy;haft&shy;pflicht&shy;ver&shy;si&shy;che&shy;rung
				</p>
			</div>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>hyphens("none")</p>
				<p lang="de" mix={[hyphens("none")]}>
					Kraft&shy;fahr&shy;zeug&shy;haft&shy;pflicht&shy;ver&shy;si&shy;che&shy;rung
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
