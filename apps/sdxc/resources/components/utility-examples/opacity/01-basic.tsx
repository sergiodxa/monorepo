/**
 * The opening `opacity` example: the same box at four opacities, so the reader sees the
 * 0–100 scale the utility takes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Four opacities on the 0–100 scale. */
export default {
	title: "Basic example",
	description:
		"Use `opacity(n)` with a value from `0` to `100` to make an element and everything inside it see-through:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[opacity(100), demo.block()]}>opacity(100)</div>
			<div mix={[opacity(75), demo.block()]}>opacity(75)</div>
			<div mix={[opacity(50), demo.block()]}>opacity(50)</div>
			<div mix={[opacity(25), demo.block()]}>opacity(25)</div>
		</div>
	),
} satisfies UtilityExampleModule;
