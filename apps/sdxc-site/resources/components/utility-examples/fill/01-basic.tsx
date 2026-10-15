/**
 * The opening `fill` example: the same icon filled in three tones, so a reader sees a
 * bare tone resolve to its text weight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A star filled in three tones. */
export default {
	title: "Basic example",
	description: "Use `fill` with a tone to set the paint inside an SVG shape:",
	render: () => (
		<div mix={[demo.row()]}>
			<svg mix={[fill("brand")]} viewBox="0 0 24 24" width={48} height={48} aria-hidden="true">
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg mix={[fill("warning")]} viewBox="0 0 24 24" width={48} height={48} aria-hidden="true">
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg mix={[fill("danger")]} viewBox="0 0 24 24" width={48} height={48} aria-hidden="true">
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
