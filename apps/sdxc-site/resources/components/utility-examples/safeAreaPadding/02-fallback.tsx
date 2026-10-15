/**
 * A `safeAreaPadding` example with a fallback length, used by a browser that defines no
 * safe-area inset at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, p, pbe, pi, safeAreaPadding } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A top bar padded by the top safe area, with a fallback length. */
export default {
	title: "Fallback value",
	description:
		'Pass a second value, like `safeAreaPadding("top", "0.75rem")`, for the padding to use in a browser that defines no safe-area inset:',
	render: () => (
		<div mix={[is(72), demo.frame()]}>
			<header mix={[pbe(3), pi(4), safeAreaPadding("top", "0.75rem"), demo.prose()]}>
				Messages
			</header>
			<p mix={[p(4), demo.caption()]}>3 unread</p>
		</div>
	),
} satisfies UtilityExampleModule;
