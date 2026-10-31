/**
 * Tests the support desk middleware: it publishes a desk on the context for the handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryTransport } from "@sdxc/mail/memory";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import supportDesk from "~/app/http/middleware/support-desk";
import { SupportDesk } from "~/app/services/support-desk";

describe("supportDesk middleware", () => {
	test("publishes a support desk on the context", async () => {
		let router = createRouter({
			middleware: [supportDesk({ transport: new MemoryTransport(), from: "reader@example.com" })],
		});
		router.get("/", (ctx) => new Response(String(ctx.supportDesk instanceof SupportDesk)));

		let response = await router.fetch(new Request("https://reader.test/"));

		expect(await response.text()).toBe("true");
	});
});
