/**
 * Runs the shared conformance suite against the memory queue. It is the pulled backend of the
 * two, so it is what holds the suite's `claim`/`settle` and delay groups to being passable at
 * all rather than merely written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { conformance } from "../testing/conformance.js";

import { queue } from "./memory.js";

/** Milliseconds the injectable clock starts at, fixed so a test reads the same time twice. */
const EPOCH = 1_757_203_200_000;

let clock = { now: EPOCH };

conformance({
	name: "memory.queue",
	create() {
		clock = { now: EPOCH };
		return queue({ now: () => clock.now });
	},
	messages: (memory) => memory.messages,
	advance(ms) {
		clock.now += ms;
	},
});
