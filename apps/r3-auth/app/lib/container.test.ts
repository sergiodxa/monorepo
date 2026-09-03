/**
 * Tests of the app container's registrations: that a send path with no request behind it
 * resolves a mailer carrying the app's sender identity. The Workers bindings are mocked
 * before the container is imported so the registrations read them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@pkg/cloudflare-mocks";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}), waitUntil: () => {} }));

let { container } = await import("~/app/lib/container");

let transport = new MemoryTransport();
let mailer: Mailer;

beforeAll(() => {
	container.instance(MailTransport, transport);
	mailer = container.get(Mailer);
});

describe("the background mailer", () => {
	test("resolves from the container", () => {
		expect(mailer).toBeInstanceOf(Mailer);
	});

	test("sends with the app's sender identity", async () => {
		let result = await mailer.send({
			to: { email: "jane@example.com" },
			subject: "A subject",
			html: "<p>A body.</p>",
		});

		expect(result.status).toBe("success");
		expect(transport.last?.from).toEqual(MAIL_FROM);
		expect(transport.last?.replyTo).toEqual([MAIL_REPLY_TO]);
	});
});
