/**
 * A `flexColReverse` example in a scrolling chat log: a reversed column starts scrolled
 * to its end, so the newest message is in view without a script scrolling it there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexColReverse, gap } from "sdxc/u/layout";
import { overflowY } from "sdxc/u/overflow";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A chat log that opens scrolled to its newest message. */
export default {
	title: "Opening a chat at the newest message",
	description:
		"A scroll container with `flexColReverse()` starts scrolled to its end, so write the newest message first and the log opens on it. Scroll up for older messages:",
	render: () => (
		<div mix={[flexColReverse(), gap(2), overflowY("auto"), is(72), bs(48), demo.frame()]}>
			<div mix={[demo.block()]}>Message 8 (newest)</div>
			<div mix={[demo.block()]}>Message 7</div>
			<div mix={[demo.block()]}>Message 6</div>
			<div mix={[demo.block()]}>Message 5</div>
			<div mix={[demo.block()]}>Message 4</div>
			<div mix={[demo.block()]}>Message 3</div>
			<div mix={[demo.block()]}>Message 2</div>
			<div mix={[demo.block()]}>Message 1 (oldest)</div>
		</div>
	),
} satisfies UtilityExampleModule;
