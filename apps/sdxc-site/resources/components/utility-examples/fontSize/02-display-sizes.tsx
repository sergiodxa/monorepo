/**
 * A `fontSize` example at the top of the scale, where the steps are sized for headlines
 * and hero numbers rather than running text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fontSize, leading, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Three display steps of the text scale, for headlines and figures. */
export default {
	title: "Display sizes",
	description:
		'The upper steps of the scale, from `fontSize("4xl")` to `fontSize("9xl")`, size headlines and large figures:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>fontSize("4xl")</p>
				<p mix={[fontSize("4xl"), leading("none"), weight("bold")]}>Quarterly report</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("6xl")</p>
				<p mix={[fontSize("6xl"), leading("none"), weight("bold")]}>$48,210</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("8xl")</p>
				<p mix={[fontSize("8xl"), leading("none"), weight("bold")]}>97%</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
