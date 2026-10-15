/**
 * An `insBe` example paired with `insIe`, pinning a toast to the trailing bottom corner of
 * the area it belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBe, insIe, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A block-end offset beside an inline-end one pins an element into a corner. */
export default {
	title: "Pinning to a corner",
	description:
		"Combine `insBe()` with `insIe()` to pin an element into the end corner of its container, like a toast:",
	render: () => (
		<div mix={[relative(), is(72), bs(40), demo.track()]}>
			<div mix={[absolute(), insBe(4), insIe(4), demo.card()]}>Changes saved</div>
		</div>
	),
} satisfies UtilityExampleModule;
