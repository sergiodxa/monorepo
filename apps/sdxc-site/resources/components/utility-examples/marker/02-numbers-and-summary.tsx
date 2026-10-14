/**
 * A `marker` example on an ordered list and on a `<summary>`, whose disclosure triangle
 * is a marker too, so the reader sees both kinds restyled by the same call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { cursor, listStyle } from "@sdxc/u/general";
import { pis } from "@sdxc/u/size";
import { marker } from "@sdxc/u/state";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Bold muted numbers on an ordered list, and a brand triangle on a summary. */
export default {
	title: "Numbers and disclosure triangles",
	description:
		"Numbered lists and a `<summary>`'s triangle are markers too. Click the summary to open it:",
	render: () => (
		<div mix={[demo.stack()]}>
			<ol mix={[listStyle("decimal"), pis(6), demo.prose()]}>
				<li mix={[marker([fg("neutral.muted"), weight("bold")])]}>Build</li>
				<li mix={[marker([fg("neutral.muted"), weight("bold")])]}>Migrate</li>
				<li mix={[marker([fg("neutral.muted"), weight("bold")])]}>Deploy</li>
			</ol>
			<details mix={[demo.prose()]}>
				<summary mix={[cursor("pointer"), weight("semibold"), marker(fg("brand"))]}>
					Release notes
				</summary>
				Every package now ships its own README.
			</details>
		</div>
	),
} satisfies UtilityExampleModule;
