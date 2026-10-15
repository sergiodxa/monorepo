/**
 * A `contrast` example stacked with other filter utilities, so the reader sees each one
 * add its own step to one composite `filter`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contrast, saturate, sepia } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Several filter utilities combined on one element. */
export default {
	title: "Combining filters",
	description:
		"Every filter utility writes its own part of one `filter`, so `contrast()` stacks with `saturate()`, `sepia()` and the rest:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[contrast(1.25), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>contrast(1.25)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img
					mix={[contrast(1.25), saturate(1.5), sepia(0.3), demo.thumb()]}
					src={demo.photoUrl()}
					alt=""
				/>
				<span mix={[demo.caption()]}>all three</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
