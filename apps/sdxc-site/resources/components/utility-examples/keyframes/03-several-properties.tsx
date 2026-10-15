/**
 * A `keyframes` example animating two properties at once, the ping that grows and fades
 * out from a notification dot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "@sdxc/u/animation";
import { absolute, inset, relative } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A ping that scales up and fades out together. */
export default {
	title: "Animating several properties",
	description: "A stop can set several properties, like `scale` and `opacity` together for a ping:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[relative(), demo.tile()]}>
				<span
					mix={[
						keyframes("ping", { "75%, 100%": { scale: "2", opacity: 0 } }),
						animationHost("ping", {
							duration: "1s",
							easing: "cubic-bezier(0, 0, 0.2, 1)",
							iterationCount: "infinite",
						}),
						absolute(),
						inset(0),
						demo.tile(),
					]}
				/>
				ping
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
