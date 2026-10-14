/**
 * An `insLeft` example with `"full"`, which places a note just past the right edge of
 * the box it annotates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insLeft, insTop, relative } from "@sdxc/u/layout";
import { mis } from "@sdxc/u/size";
import { nowrap } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A left offset of the parent's full width starts an element where the parent ends. */
export default {
	title: "Placing beside the parent",
	description:
		'Use `insLeft("full")` to start an element where its positioned parent ends, like a note beside the box it describes:',
	render: () => (
		<div mix={[relative(), demo.block()]}>
			Draft
			<div mix={[absolute(), insLeft("full"), insTop(0), mis(3), nowrap(), demo.caption()]}>
				← saved 2 minutes ago
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
