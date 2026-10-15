/**
 * The opening `z` example: overlapping circles whose stacking order runs against their
 * source order, so the reader sees a higher `z-index` paint on top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { shadow } from "sdxc/u/effects";
import { relative } from "sdxc/u/layout";
import { circle, is, mis } from "sdxc/u/size";
import { z } from "sdxc/u/stacking";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The first circle in the source sits on top because it has the highest value. */
export default {
	title: "Basic example",
	description:
		"Use `z(n)` to set a positioned element's stacking order; higher values paint over lower ones:",
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					relative(),
					z(40),
					circle(),
					is(20),
					shadow("md"),
					border({ color: "brand.strong", width: 2 }),
					demo.fill(),
				]}
			>
				z(40)
			</div>
			<div
				mix={[
					relative(),
					z(30),
					circle(),
					is(20),
					mis(-6),
					shadow("md"),
					border({ color: "brand.strong", width: 2 }),
					demo.fill(),
				]}
			>
				z(30)
			</div>
			<div
				mix={[
					relative(),
					z(20),
					circle(),
					is(20),
					mis(-6),
					shadow("md"),
					border({ color: "brand.strong", width: 2 }),
					demo.fill(),
				]}
			>
				z(20)
			</div>
			<div
				mix={[
					relative(),
					z(10),
					circle(),
					is(20),
					mis(-6),
					shadow("md"),
					border({ color: "brand.strong", width: 2 }),
					demo.fill(),
				]}
			>
				z(10)
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
