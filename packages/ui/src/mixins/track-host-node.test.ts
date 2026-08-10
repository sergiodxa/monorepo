/**
 * Unit tests for the host-node lifecycle cache in
 * {@link "./track-host-node"}: every assertion drives a plain `EventTarget`
 * standing in for a mixin handle through its `insert`/`remove` events, with
 * no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { MixinHandle } from "remix/ui";

import { trackHostNode } from "./track-host-node";

/**
 * Builds a plain `EventTarget` standing in for a mixin handle, along with
 * helpers dispatching the `insert`/`remove` events {@link trackHostNode}
 * listens for.
 */
function createHostHandle() {
	let target = new EventTarget();

	return {
		handle: target as unknown as MixinHandle<EventTarget>,
		insert(node: EventTarget) {
			let event = new Event("insert") as Event & { node: EventTarget };
			event.node = node;
			target.dispatchEvent(event);
		},
		remove() {
			target.dispatchEvent(new Event("remove"));
		},
	};
}

describe(trackHostNode.name, () => {
	test("reports undefined before any node is inserted", () => {
		let { handle } = createHostHandle();

		expect(trackHostNode(handle)()).toBeUndefined();
	});

	test("reports the node dispatched by an insert event", () => {
		let { handle, insert } = createHostHandle();
		let hostNode = trackHostNode(handle);
		let node = new EventTarget();

		insert(node);

		expect(hostNode()).toBe(node);
	});

	test("reports undefined again once a remove event fires", () => {
		let { handle, insert, remove } = createHostHandle();
		let hostNode = trackHostNode(handle);

		insert(new EventTarget());
		remove();

		expect(hostNode()).toBeUndefined();
	});

	test("reports the latest node across a remove-then-reinsert cycle", () => {
		let { handle, insert, remove } = createHostHandle();
		let hostNode = trackHostNode(handle);
		let first = new EventTarget();
		let second = new EventTarget();

		insert(first);
		remove();
		insert(second);

		expect(hostNode()).toBe(second);
	});

	test("returns a getter that always reads the currently mounted node", () => {
		let { handle, insert } = createHostHandle();
		let hostNode = trackHostNode(handle);
		let node = new EventTarget();

		insert(node);

		expect(hostNode()).toBe(node);
		expect(hostNode()).toBe(node);
	});
});
