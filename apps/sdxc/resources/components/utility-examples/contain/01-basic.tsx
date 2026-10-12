/**
 * The opening `contain` example: a fixed element that stays inside its box, because
 * content containment makes the box the containing block for its fixed descendants.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contain, fixed, insBottom, insRight } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A fixed child kept inside a box with content containment. */
export default {
	title: "Basic example",
	description:
		"Use `contain()` to promise the browser an element's contents stay inside it; the element also becomes the box its `fixed()` and `absolute()` children position against:",
	render: () => (
		<div mix={[contain(), is(72), bs(32), demo.track()]}>
			<div mix={[fixed(), insBottom(3), insRight(3), demo.block()]}>fixed()</div>
		</div>
	),
} satisfies UtilityExampleModule;
