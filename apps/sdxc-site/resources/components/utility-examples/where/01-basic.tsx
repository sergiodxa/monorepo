/**
 * The opening `where` example: a block of rendered markdown whose links are styled from
 * the container, so the reader sees descendants styled without classes of their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { where } from "sdxc/u/state";
import { textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Brand, underlined links anywhere inside the article. */
export default {
	title: "Basic example",
	description:
		"Pass a selector to `where()` to style the descendants it matches, like the links in content you did not write the markup for:",
	render: () => (
		<article
			mix={[
				where("a", [fg("brand"), textDecoration({ line: "underline", offset: 3 })]),
				demo.prose(),
			]}
		>
			<p>
				Read the <a href="#guide">getting started guide</a>, then browse the{" "}
				<a href="#api">API reference</a>.
			</p>
		</article>
	),
} satisfies UtilityExampleModule;
