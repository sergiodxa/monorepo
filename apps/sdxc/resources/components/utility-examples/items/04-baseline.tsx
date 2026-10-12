/**
 * An `items` example with `"baseline"`: boxes padded by different amounts line their
 * labels up on one baseline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Baseline alignment lines up the first line of text in every item. */
export default {
	title: "Baseline",
	description:
		'Use `items("baseline")` to align items so the first lines of their text share a baseline:',
	render: () => (
		<div mix={[flex(), gap(4), items("baseline"), is(80), demo.stripes()]}>
			<div mix={[p(2, 4), demo.box()]}>01</div>
			<div mix={[p(8, 4), demo.box()]}>02</div>
			<div mix={[p(5, 4), demo.box()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
