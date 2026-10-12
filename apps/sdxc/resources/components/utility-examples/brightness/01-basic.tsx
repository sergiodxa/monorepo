/**
 * The opening `brightness` example: the same photograph darkened and brightened, so the
 * reader sees which side of `1` does what.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { brightness } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Brightness below and above the untouched `1`. */
export default {
	title: "Basic example",
	description:
		"Use `brightness(n)` to scale an element's lightness, where values below `1` darken it and values above `1` brighten it:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[brightness(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>brightness(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[brightness(1), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>brightness(1)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[brightness(1.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>brightness(1.5)</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
