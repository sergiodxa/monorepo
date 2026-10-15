/**
 * An `after` example marking links that leave the site with an arrow, combined with an
 * attribute selector, so the reader sees generated content applied by a rule, not markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { pseudoContent } from "sdxc/u/general";
import { after, when } from "sdxc/u/state";
import { textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An arrow after only the links that open in a new tab. */
export default {
	title: "Marking external links",
	description:
		'Nest `after()` in another state to generate content only where it applies, like an arrow after links with `target="_blank"`:',
	render: () => (
		<p mix={[demo.prose()]}>
			Read the{" "}
			<a
				href="#guide"
				mix={[
					fg("brand"),
					textDecoration(),
					when('&[target="_blank"]', after(pseudoContent('" ↗"'))),
				]}
			>
				guide
			</a>{" "}
			or the{" "}
			<a
				href="https://github.com"
				target="_blank"
				mix={[
					fg("brand"),
					textDecoration(),
					when('&[target="_blank"]', after(pseudoContent('" ↗"'))),
				]}
			>
				source on GitHub
			</a>
			.
		</p>
	),
} satisfies UtilityExampleModule;
