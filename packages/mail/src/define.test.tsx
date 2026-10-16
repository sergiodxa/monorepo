/**
 * Tests `defineEmail()` through a mailer over the memory transport: the class it builds
 * addresses, titles and renders an email from its props, carries the optional delivery
 * fields, and stays a distinct class a test can match a sent message against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MemoryTransport } from "./memory.js";

import { Email, Mailer, defineEmail, isEmail } from "./index.js";

/** Sender identity every test mailer is configured with. */
const SENDER = { email: "no-reply@example.com" };

namespace InviteEmail {
	export interface Props {
		team: string;
		url: string;
	}
}

/** An invite built from its props, standing in for one an app defines. */
const InviteEmail = defineEmail<InviteEmail.Props>({
	subject: (props) => `Join ${props.team}`,
	body: (handle) => () => (
		<Email.Layout title={handle.props.team}>
			<Email.Text>You have been invited to {handle.props.team}.</Email.Text>
			<Email.Button href={handle.props.url}>Accept invite</Email.Button>
		</Email.Layout>
	),
});

/** A second definition with the same props, to prove each call builds its own class. */
const ReminderEmail = defineEmail<InviteEmail.Props>({
	subject: (props) => `Still want to join ${props.team}?`,
	body: (handle) => () => <p>{handle.props.team}</p>,
	unsubscribe: (props) => ({ url: `${props.url}/unsubscribe` }),
	list: () => ({ id: "reminders.example.com" }),
	headers: () => ({ "X-Kind": "reminder" }),
	replyTo: () => ({ email: "team@example.com" }),
});

/** Builds a mailer over a fresh in-memory transport, returning both for assertions. */
function createMailer() {
	let transport = new MemoryTransport();
	return { mailer: new Mailer({ transport, from: SENDER }), transport };
}

describe("defineEmail", () => {
	test("addresses a bare string recipient as its mailbox", () => {
		let email = new InviteEmail("ada@example.com", { team: "Acme", url: "https://acme.com" });

		expect(isEmail(email)).toBe(true);
		expect(email.to).toEqual({ email: "ada@example.com" });
		expect(email.subject).toBe("Join Acme");
		expect(email.props).toEqual({ team: "Acme", url: "https://acme.com" });
	});

	test("keeps addresses passed as addresses", () => {
		let to = [{ email: "ada@example.com", name: "Ada" }, { email: "grace@example.com" }];
		let email = new InviteEmail(to, { team: "Acme", url: "https://acme.com" });

		expect(email.to).toBe(to);
	});

	test("renders the body from the props it was built with", async () => {
		let { mailer, transport } = createMailer();

		let result = await mailer.send(
			new InviteEmail("ada@example.com", { team: "Acme", url: "https://acme.com/join" }),
		);

		expect(isSuccess(result)).toBe(true);
		expect(transport.last?.subject).toBe("Join Acme");
		expect(transport.last?.html).toContain('href="https://acme.com/join"');
		expect(transport.last?.text).toContain("You have been invited to Acme.");
	});

	test("carries the optional delivery fields onto the message", async () => {
		let { mailer, transport } = createMailer();

		await mailer.send(
			new ReminderEmail("ada@example.com", { team: "Acme", url: "https://acme.com" }),
		);

		expect(transport.last?.replyTo).toEqual([{ email: "team@example.com" }]);
		expect(transport.last?.headers["X-Kind"]).toBe("reminder");
		expect(transport.last?.headers["List-Id"]).toBe("<reminders.example.com>");
		expect(transport.last?.unsubscribe).toEqual({ url: "https://acme.com/unsubscribe" });
	});

	test("builds a distinct class per definition, so a sent message is matched by type", async () => {
		let { mailer, transport } = createMailer();
		let props = { team: "Acme", url: "https://acme.com" };

		await mailer.send(new ReminderEmail("ada@example.com", props));
		await mailer.send(new InviteEmail("grace@example.com", props));

		let invite = transport.find((message) => message.email instanceof InviteEmail);
		expect(invite?.to).toEqual([{ email: "grace@example.com" }]);
		expect(transport.last?.email).not.toBeInstanceOf(ReminderEmail);
	});
});
