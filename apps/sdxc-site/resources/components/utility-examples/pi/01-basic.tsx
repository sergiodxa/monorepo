/**
 * The opening `pi` example: a box padded on both inline edges, with the padding drawn as
 * stripes on either side of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on both inline edges. */
export default {
	title: "Basic example",
	description:
		"Use `pi(n)` to pad the inline-start and inline-end edges of an element, its left and right in horizontal text:",
	render: () => (
		<div mix={[pi(8), demo.stripes()]}>
			<div mix={[demo.block()]}>pi(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
