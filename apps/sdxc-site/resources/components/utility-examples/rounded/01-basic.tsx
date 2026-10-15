/**
 * The opening `rounded` example: the same box at each step of the radius scale, so the
 * reader sees how round each named step makes a corner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each named step of the radius scale on the same box. */
export default {
	title: "Basic example",
	description:
		'Use `rounded("sm")`, `rounded("md")`, `rounded("lg")` or `rounded("xl")` to round an element\'s corners by a step of the radius scale:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("sm"), demo.shape()]}>rounded("sm")</div>
			<div mix={[rounded("md"), demo.shape()]}>rounded("md")</div>
			<div mix={[rounded("lg"), demo.shape()]}>rounded("lg")</div>
			<div mix={[rounded("xl"), demo.shape()]}>rounded("xl")</div>
		</div>
	),
} satisfies UtilityExampleModule;
