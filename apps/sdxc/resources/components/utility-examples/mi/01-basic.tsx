/**
 * The opening `mi` example: one box with margin on both inline edges, drawn as stripes
 * on either side of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mi } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on both inline edges. */
export default {
	title: "Basic example",
	description:
		"Use `mi(n)` to add margin to the inline-start and inline-end edges of an element, left and right of it in horizontal text:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mi(8), demo.block()]}>mi(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
