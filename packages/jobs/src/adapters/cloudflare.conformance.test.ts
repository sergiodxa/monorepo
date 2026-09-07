/**
 * Runs the shared conformance suite against the Cloudflare backend, over a recording binding.
 * It pushes rather than being pulled, so what it answers here is the enqueue half of the
 * contract plus the delay it refuses at the platform's twelve-hour ceiling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Queue } from "@cloudflare/workers-types";

import { createQueue } from "@sdxc/cloudflare-mocks";

import { conformance } from "../testing/conformance.js";

import { queue } from "./cloudflare.js";

/** Past the twelve hours the platform holds a message for, so the ceiling group registers. */
const OVER_CEILING = "13 hours";

let binding = createQueue({ name: "jobs" });

conformance({
	name: "cloudflare.queue",
	create() {
		binding = createQueue({ name: "jobs" });
		return queue(() => binding as unknown as Queue);
	},
	messages: () => binding.messages.map((message) => message.body),
	unsupportedDelay: OVER_CEILING,
});
