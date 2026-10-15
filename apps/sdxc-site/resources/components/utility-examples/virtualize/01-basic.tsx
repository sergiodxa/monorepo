/**
 * The `virtualize` example: a list of a thousand rows where only the rows near the
 * viewport render, each skipped row holding its place with a placeholder height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { virtualize } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Off-screen rows skip rendering while keeping the scrollbar steady. */
export default {
	title: "Basic example",
	description:
		"Use `virtualize(size)` on the rows of a long list so the browser skips rendering the ones off screen, using `size` as their placeholder height:",
	render: () => (
		<div mix={[overflow("auto"), is(72), bs(64), demo.frame()]}>
			{Array.from({ length: 1000 }, (_, index) => (
				<div mix={[virtualize("auto 2.75rem"), p(2, 4), demo.prose()]}>Row {index + 1}</div>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
