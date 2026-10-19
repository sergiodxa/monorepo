/**
 * The app's mail transport, delivering into the in-memory `send_email` stand-in tests receive
 * as the `EMAIL` binding.
 */

import { Mailer } from "@sdxc/mail";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { transport } from "~/app/initializers/mail-transport";
import { MAIL_FROM } from "~/config/constants";

describe("transport", () => {
	test("delivers a message through the EMAIL binding", async () => {
		let mailer = new Mailer({ transport, from: MAIL_FROM });

		await mailer.send({
			to: { email: "ada@example.com" },
			subject: "Welcome",
			html: "<p>Hello.</p>",
		});

		expect(env.EMAIL).toMatchObject({
			messages: [expect.objectContaining({ subject: "Welcome" })],
		});
	});
});
