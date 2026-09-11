/**
 * Tests of the background mailer: a send path with no request behind it delivers through
 * the transport it was handed and carries the app's sender identity. The Workers bindings
 * are mocked before the module is imported so it reads them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { MemoryTransport } from "@sdxc/mail/memory";
import { describe, expect, test, vi } from "vitest";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}), waitUntil: () => {} }));

let { createMailer } = await import("~/app/lib/mail");

describe("the background mailer", () => {
	test("sends with the app's sender identity", async () => {
		let transport = new MemoryTransport();

		let result = await createMailer(transport).send({
			to: { email: "jane@example.com" },
			subject: "A subject",
			html: "<p>A body.</p>",
		});

		expect(result.status).toBe("success");
		expect(transport.last?.from).toEqual(MAIL_FROM);
		expect(transport.last?.replyTo).toEqual([MAIL_REPLY_TO]);
	});
});
