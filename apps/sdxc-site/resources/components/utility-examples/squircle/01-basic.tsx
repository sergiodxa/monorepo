/**
 * The opening `squircle` example: a plain rounded box beside a squircle at the same
 * radius, so the smoother curve shows against the plain one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";
import { aspect, is, squircle } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A squircle against a plain rounded box at one radius. */
export default {
	title: "Basic example",
	description:
		"Use `squircle()` to round an element's corners with a smooth, continuous curve. Browsers without `corner-shape` draw the plain rounded corner:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("3rem"), is(36), aspect("square"), demo.fill()]}>rounded</div>
			<div mix={[squircle("3rem"), is(36), aspect("square"), demo.fill()]}>squircle</div>
		</div>
	),
} satisfies UtilityExampleModule;
