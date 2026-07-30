/**
 * Tests `sendInviteEmail`: it renders the team-invite email body to an HTML string
 * and calls Resend's `emails.send` with the app's fixed from/reply-to addresses, the
 * given recipient, a subject naming the team, and rendered HTML containing the team
 * name and the invite URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Resend } from "resend";

import { sendInviteEmail } from "./invite-email";

/** Builds a fake `Resend` client with a mocked `emails.send`. */
function createFakeResend() {
	let send = mock(async () => ({ data: { id: "test-email-id" }, error: null }));
	return { resend: { emails: { send } } as unknown as Resend, send };
}

describe("sendInviteEmail", () => {
	test("sends the invite email with the expected from/reply-to/to/subject/html", async () => {
		let { resend, send } = createFakeResend();

		await sendInviteEmail(resend, "Acme", "a@example.com", "https://example.com/invite/123");

		expect(send).toHaveBeenCalledTimes(1);

		let call = send.mock.calls[0];
		if (!call) throw new Error("expected emails.send to have been called");
		let [payload] = call as unknown as [
			{ from: string; replyTo: string; to: string; subject: string; html: string },
		];

		expect(payload.from).toBe("Uptime <no-reply@uptime.sergiodxa.com>");
		expect(payload.replyTo).toBe("hello@sergiodxa.com");
		expect(payload.to).toBe("a@example.com");
		expect(payload.subject).toBe("You've been invited to join Acme on Uptime");
		expect(payload.html).toContain("Acme");
		expect(payload.html).toContain("https://example.com/invite/123");
	});
});
