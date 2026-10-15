/**
 * The opening `filterOpacity` example: the same photograph faded to three amounts, so
 * the reader sees CSS's native `0`–`1` range at work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { filterOpacity } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Three fades in the native `0`–`1` range. */
export default {
	title: "Basic example",
	description:
		"Use `filterOpacity(n)` to fade an element inside its `filter`, taking a value from `0` to `1`:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<img mix={[filterOpacity(0.25), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>filterOpacity(0.25)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[filterOpacity(0.5), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>filterOpacity(0.5)</span>
			</div>
			<div mix={[demo.figure()]}>
				<img mix={[filterOpacity(0.75), demo.thumb()]} src={demo.photoUrl()} alt="" />
				<span mix={[demo.caption()]}>filterOpacity(0.75)</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
