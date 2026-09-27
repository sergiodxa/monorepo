/**
 * Checks the one-click way out of the email channel: a link signed for a reader names that
 * reader and nobody else, links mailed under the session secret keep working, a link neither
 * key signed names nobody, and a notification email
 * carries the headers a mailbox provider draws its unsubscribe button from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@sdxc/mail/unsubscribe";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, test, vi } from "vitest";

import { UNSUBSCRIBE_SECRET, UNSUBSCRIBE_SECRET_VALUE } from "~/app/lib/test/unsubscribe-secret";
import { NotificationEmail } from "~/app/push/copy";
import { unsubscribeUrl, unsubscribingReader } from "~/app/push/unsubscribe";

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();
	let { withUnsubscribeSecret } = await import("~/app/lib/test/unsubscribe-secret");
	return { ...original, env: withUnsubscribeSecret(original.env) };
});

afterEach(() => UNSUBSCRIBE_SECRET.reset());

/** The purpose every link is signed under, with either key. */
const PURPOSE = { purpose: "reader-notifications-unsubscribe:v1:" };

/** One reader's OIDC subject, which is what a link is signed for. */
const SUBJECT = "01J0READER0000000000000000";

/** Where the app answers in these tests. */
const APP_URL = "https://reader.example.test";

/** The token segment of a signed link. */
function tokenOf(url: string): string {
	return new URL(url).pathname.split("/").at(-1) ?? "";
}

describe("the unsubscribe link", () => {
	test("names the reader it was signed for", async () => {
		let url = unwrap(await unsubscribeUrl(SUBJECT, APP_URL));

		expect(url.startsWith(`${APP_URL}/notifications/unsubscribe/`)).toBe(true);
		expect(url).not.toContain("@");
		expect(await unsubscribingReader(tokenOf(url))).toBe(SUBJECT);
	});

	test("names nobody once a character of it changes", async () => {
		let token = tokenOf(unwrap(await unsubscribeUrl(SUBJECT, APP_URL)));
		let tampered = `${token.startsWith("0") ? "1" : "0"}${token.slice(1)}`;

		expect(await unsubscribingReader(tampered)).toBeNull();
		expect(await unsubscribingReader("not-a-token")).toBeNull();
	});

	test("is signed with the dedicated key rather than the session secret", async () => {
		let token = tokenOf(unwrap(await unsubscribeUrl(SUBJECT, APP_URL)));

		let dedicated = await verifyUnsubscribeToken(UNSUBSCRIBE_SECRET_VALUE, token, PURPOSE);
		let session = await verifyUnsubscribeToken(env.COOKIE_SESSION_SECRET, token, PURPOSE);

		expect(isSuccess(dedicated) && dedicated.data.subject).toBe(SUBJECT);
		expect(isFailure(session)).toBe(true);
	});

	test("is not built while the dedicated key cannot be read", async () => {
		UNSUBSCRIBE_SECRET.fail();

		expect(isFailure(await unsubscribeUrl(SUBJECT, APP_URL))).toBe(true);
	});

	test("still names the reader of a link mailed under the session secret, and counts it", async () => {
		let token = unwrap(
			await signUnsubscribeToken(
				env.COOKIE_SESSION_SECRET,
				{ subject: SUBJECT, list: "notifications" },
				PURPOSE,
			),
		);
		let record: Record<string, unknown> = {};
		let log = new Log({ kind: "request", sink: (emitted) => void (record = emitted) });

		expect(await log.run(() => unsubscribingReader(token))).toBe(SUBJECT);
		expect(JSON.stringify(record)).toContain("legacy_secret");

		UNSUBSCRIBE_SECRET.fail();
		expect(await unsubscribingReader(token)).toBe(SUBJECT);
	});

	test("names nobody for a token signed with neither key", async () => {
		let token = unwrap(
			await signUnsubscribeToken(
				"some-other-key",
				{ subject: SUBJECT, list: "notifications" },
				PURPOSE,
			),
		);

		expect(await unsubscribingReader(token)).toBeNull();
	});

	test("names nobody for a token the same key signed for another purpose or list", async () => {
		let otherPurpose = unwrap(
			await signUnsubscribeToken(env.COOKIE_SESSION_SECRET, {
				subject: SUBJECT,
				list: "notifications",
			}),
		);
		let otherList = unwrap(
			await signUnsubscribeToken(
				env.COOKIE_SESSION_SECRET,
				{ subject: SUBJECT, list: "digest" },
				{ purpose: "reader-notifications-unsubscribe:v1:" },
			),
		);

		expect(await unsubscribingReader(otherPurpose)).toBeNull();
		expect(await unsubscribingReader(otherList)).toBeNull();
	});
});

describe("the notification email", () => {
	/** Sends one notification through a mailer that records rather than delivers. */
	async function sent(unsubscribe: string | null) {
		let transport = new MemoryTransport();
		let mailer = new Mailer({ transport, from: { email: "reader@example.test" } });

		let result = await mailer.send(
			new NotificationEmail(
				"someone@example.com",
				{ title: "3 new posts", body: "From Example." },
				`${APP_URL}/reading`,
				{
					reason: "You asked for these.",
					unsubscribeUrl: unsubscribe,
					unsubscribeLabel: "Stop these emails.",
					listName: "Reader notifications",
				},
			),
		);

		unwrap(result);
		return { message: transport.last };
	}

	test("carries the one-click headers and the list, so the provider draws its button", async () => {
		let url = unwrap(await unsubscribeUrl(SUBJECT, APP_URL));
		let { message } = await sent(url);

		expect(message?.headers["List-Unsubscribe"]).toBe(`<${url}>`);
		expect(message?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
		expect(message?.headers["List-Id"]).toBe(
			"Reader notifications <notifications.reader.example.test>",
		);
		expect(message?.html).toContain(url);
	});

	test("goes out without the headers where no link could be signed", async () => {
		let { message } = await sent(null);

		expect(message?.headers["List-Unsubscribe"]).toBeUndefined();
		expect(message?.headers["List-Unsubscribe-Post"]).toBeUndefined();
	});
});
