/**
 * Tests of the app container's mail registrations: that a send path with no request
 * behind it can resolve a mailer at all, and that the one it resolves carries the same
 * sender identity the request-scoped mailer applies.
 *
 * The transport is overridden before the mailer is first resolved, which is what makes
 * this assertable without a Workers environment: the registration builds the mailer from
 * whatever `MailTransport` resolves to, so replacing that key replaces delivery and
 * nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeAll, describe, expect, mock, test } from "bun:test";

import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";

mock.module("cloudflare:workers", () => ({ env: {}, waitUntil: () => {} }));

let transport = new MemoryTransport();
let mailer: Mailer;

beforeAll(async () => {
	let { container } = await import("~/app/lib/container");

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
