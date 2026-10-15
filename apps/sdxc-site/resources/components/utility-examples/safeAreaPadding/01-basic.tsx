/**
 * The opening `safeAreaPadding` example: a bottom tab bar that clears a phone's home
 * indicator, and sits flush on a screen with no safe area.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { is, p, pbs, safeAreaPadding } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bottom bar padded by the device's bottom safe area. */
export default {
	title: "Basic example",
	description:
		'Use `safeAreaPadding("bottom")` to keep a bottom bar clear of a phone\'s home indicator. It needs `viewport-fit=cover` in the viewport meta tag, and adds nothing on a screen without a safe area:',
	render: () => (
		<div mix={[is(72), demo.frame()]}>
			<p mix={[p(4), demo.prose()]}>Inbox</p>
			<nav mix={[hstack({ justify: "around" }), pbs(3), safeAreaPadding("bottom"), demo.caption()]}>
				<span>Home</span>
				<span>Search</span>
				<span>Profile</span>
			</nav>
		</div>
	),
} satisfies UtilityExampleModule;
