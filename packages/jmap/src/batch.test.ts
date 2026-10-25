/**
 * Builds the method calls of the RFC 8620, RFC 8621 and RFC 9610 examples with `Batch`
 * and checks the Request object matches them call for call, result references and
 * `using` included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import type { Call } from "./batch.js";

import { Batch } from "./batch.js";
import { CAPABILITIES } from "./capabilities.js";
import { ECHO, INBOX_THREADS_CALLS, PUSH_SUBSCRIPTION_CREATE_CALLS } from "./fixtures/rfc8620.js";
import { EMAIL_GET_CALLS, MAILBOX_CHANGES_CALLS, SUBMISSION_CALLS } from "./fixtures/rfc8621.js";
import { INITIAL_CALLS, SET_DEFAULT_CALLS } from "./fixtures/rfc9610.js";

describe("Batch", () => {
	test("chains the inbox threads example through result references", () => {
		let batch = new Batch();
		let query = batch.call(
			"Email/query",
			{
				accountId: "A1",
				filter: { inMailbox: "id_of_inbox" },
				sort: [{ property: "receivedAt", isAscending: false }],
				collapseThreads: true,
				position: 0,
				limit: 10,
				calculateTotal: true,
			},
			{ id: "t0" },
		);
		let emails = batch.call(
			"Email/get",
			{ accountId: "A1", ids: query.ref("/ids"), properties: ["threadId"] },
			{ id: "t1" },
		);
		let threads = batch.call(
			"Thread/get",
			{ accountId: "A1", ids: emails.ref(["list", "*", "threadId"]) },
			{ id: "t2" },
		);
		batch.call(
			"Email/get",
			{
				accountId: "A1",
				ids: threads.ref("/list/*/emailIds"),
				properties: ["from", "receivedAt", "subject"],
			},
			{ id: "t3" },
		);

		expect(batch.toJSON()).toEqual({
			using: [CAPABILITIES.core, CAPABILITIES.mail],
			methodCalls: INBOX_THREADS_CALLS,
		});
	});

	test("numbers calls by position and references a response's other properties", () => {
		let batch = new Batch();
		let changes = batch.call("Mailbox/changes", { accountId: "u33084183", sinceState: "78540" });
		batch.call("Mailbox/get", { accountId: "u33084183", ids: changes.ref("/created") });
		batch.call("Mailbox/get", {
			accountId: "u33084183",
			ids: changes.ref("/updated"),
			properties: changes.ref("/updatedProperties"),
		});

		expect(batch.toJSON().methodCalls).toEqual(MAILBOX_CHANGES_CALLS);
		expect(batch.size).toBe(3);
	});

	test("writes header properties and body arguments of Email/get as given", () => {
		let batch = new Batch();
		batch.call(
			"Email/get",
			{
				accountId: "abc",
				ids: ["f123u456", "f123u457"],
				properties: [
					"threadId",
					"mailboxIds",
					"from",
					"subject",
					"receivedAt",
					"header:List-POST:asURLs",
					"htmlBody",
					"bodyValues",
				],
				bodyProperties: ["partId", "blobId", "size", "type"],
				fetchHTMLBodyValues: true,
				maxBodyValueBytes: 256,
			},
			{ id: "#1" },
		);

		expect(batch.toJSON().methodCalls).toEqual(EMAIL_GET_CALLS);
	});

	test("names mail and submission for an EmailSubmission and keeps creation references verbatim", () => {
		let batch = new Batch();
		batch.call("EmailSubmission/set", {
			accountId: "ue411d190",
			create: {
				k1490: {
					identityId: "I64588216",
					emailId: "M7f6ed5bcfd7e2604d1753f6c",
					envelope: {
						mailFrom: { email: "john@example.com", parameters: null },
						rcptTo: [{ email: "jane@example.com", parameters: null }],
					},
				},
			},
			onSuccessUpdateEmail: {
				"#k1490": {
					"mailboxIds/7cb4e8ee-df87-4757-b9c4-2ea1ca41b38e": null,
					"mailboxIds/73dbcb4b-bffc-48bd-8c2a-a2e91ca672f6": true,
					"keywords/$draft": null,
				},
			},
		});

		expect(batch.toJSON()).toEqual({
			using: [CAPABILITIES.core, CAPABILITIES.mail, CAPABILITIES.submission],
			methodCalls: SUBMISSION_CALLS,
		});
	});

	test("names contacts for the RFC 9610 calls", () => {
		let fetch = new Batch();
		fetch.call("AddressBook/get", { accountId: "a0x9" });
		fetch.call("ContactCard/get", { accountId: "a0x9" });
		let setDefault = new Batch();
		setDefault.call("AddressBook/set", {
			accountId: "a0x9",
			onSuccessSetIsDefault: "cd40089d-35f9-4fd7-980b-ba3a9f1d74fe",
		});

		expect(fetch.toJSON()).toEqual({
			using: [CAPABILITIES.core, CAPABILITIES.contacts],
			methodCalls: INITIAL_CALLS,
		});
		expect(setDefault.toJSON().methodCalls).toEqual(SET_DEFAULT_CALLS);
	});

	test("sends account-less PushSubscription and Core/echo calls under core alone", () => {
		let batch = new Batch();
		batch.call("PushSubscription/set", {
			create: {
				"4f29": {
					deviceClientId: "a889-ffea-910",
					url: "https://example.com/push/?device=X8980fc&client=12c6d086",
					types: null,
				},
			},
		});
		let echo = new Batch();
		echo.call("Core/echo", { hello: true, high: 5 }, { id: "b3ff" });

		expect(batch.toJSON()).toEqual({
			using: [CAPABILITIES.core],
			methodCalls: PUSH_SUBSCRIPTION_CREATE_CALLS,
		});
		expect(echo.toJSON().methodCalls).toEqual(ECHO);
	});

	test("adds the caller's capabilities and inherited creation ids, and drops undefined arguments", () => {
		let batch = new Batch({
			using: ["https://example.com/apis/foobar"],
			createdIds: { k15: "a" },
		});
		batch.call("Mailbox/get", { accountId: "x", ids: undefined });

		expect(batch.toJSON()).toEqual({
			using: [CAPABILITIES.core, "https://example.com/apis/foobar", CAPABILITIES.mail],
			methodCalls: [["Mailbox/get", { accountId: "x" }, "0"]],
			createdIds: { k15: "a" },
		});
	});

	test("serializes through JSON.stringify", () => {
		let batch = new Batch();
		batch.call("Identity/get", { accountId: "acme" });

		expect(JSON.parse(JSON.stringify(batch))).toEqual(batch.toJSON());
	});

	test("types each call by its method", () => {
		let batch = new Batch();
		let call = batch.call("Thread/get", { accountId: "a", ids: ["t"] });

		expectTypeOf(call).toEqualTypeOf<Call<"Thread/get">>();
		// @ts-expect-error -- Thread/get has no `filter` argument
		batch.call("Thread/get", { accountId: "a", filter: {} });
	});
});
