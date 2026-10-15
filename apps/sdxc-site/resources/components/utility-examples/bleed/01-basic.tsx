/**
 * The opening `bleed` example: a photograph inside a padded card pulled out to the
 * card's edges, while the text around it keeps the card's padding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { aspect, bleed, is, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bleed matching the container's inline padding reaches its edges. */
export default {
	title: "Basic example",
	description:
		"Use `bleed(n)` with the same step as the container's inline padding to pull an element out to the container's edges, like a full-width photo in a padded card:",
	render: () => (
		<div mix={[p(6), is(80), demo.frame()]}>
			<p mix={[demo.prose()]}>A card padded on every side.</p>
			<div mix={[bleed(6), aspect("video"), demo.photo()]} />
			<p mix={[demo.prose()]}>The photo reaches both edges.</p>
		</div>
	),
} satisfies UtilityExampleModule;
