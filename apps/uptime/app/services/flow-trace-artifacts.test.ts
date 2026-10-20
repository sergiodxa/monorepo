/**
 * Tests the in-run artifact buffer that captures `browser.trace.stop` JSON when
 * the flow workspace has no filesystem.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { createFlowTraceBuffer } from "~/app/services/flow-trace-artifacts";

describe("createFlowTraceBuffer", () => {
	test("keeps only the last JSON body written through the artifact store", async () => {
		let buffer = createFlowTraceBuffer();

		expect(buffer.lastTraceJson()).toBeNull();
		await buffer.store.write("first.json", '{"n":1}');
		await buffer.store.write("second.json", '{"n":2}');

		expect(buffer.lastTraceJson()).toBe('{"n":2}');
	});

	test("decodes binary writes the same way as text", async () => {
		let buffer = createFlowTraceBuffer();
		await buffer.store.write("trace.json", new TextEncoder().encode('{"ok":true}'));

		expect(buffer.lastTraceJson()).toBe('{"ok":true}');
	});
});
