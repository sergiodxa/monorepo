/**
 * `/docs/contact` is where a docs reader the guides did not help writes to the author: a short
 * form that emails the inbox with the reader's address as reply-to, so an answer goes straight
 * back to them. The page they came from rides along, so the question arrives with its context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationError } from "@sdxc/validate";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, DocsPageHeader, FieldError, Label, TextArea, TextField } from "@sdxc/ui";
import { validate } from "@sdxc/validate";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import emails from "~/app/emails";
import { DocsContactSchema, sameSitePath } from "~/app/http/validators/docs-contact";
import { buildGuidesNav } from "~/app/services/navigation";
import { absoluteUrl, CONTACT_INBOX } from "~/config/constants";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The query parameter the success redirect sets, which swaps the form for the thank-you. */
const SENT_PARAM = "sent";

/** The fields a reader may get wrong, each with the message it shows. */
const FIELD_MESSAGES = {
	email: "Enter the email address the reply should go to.",
	message: "Write your question before sending.",
} as const;

/** What the page shows: the reader's own words back, and which fields need another look. */
interface ContactView {
	values: { name: string; email: string; message: string; page: string };
	errors: Partial<Record<keyof typeof FIELD_MESSAGES, string>>;
	/** `sent` thanks the reader; `expired` and `failed` keep the form with a notice above it. */
	state: "form" | "sent" | "expired" | "failed";
}

/** The notice each refused-but-kept state opens the form with. */
const NOTICES = {
	expired: "This form was open too long to send. Check your message and send it again.",
	failed: `Your message couldn’t be sent right now. Try again in a moment, or email ${CONTACT_INBOX} directly.`,
} as const;

/** The fields a validation failure names, each mapped to the message it shows. */
function errorsOf(error: ValidationError): ContactView["errors"] {
	let errors: ContactView["errors"] = {};
	for (let issue of error.issues) {
		let key = issue.path?.[0];
		let name = typeof key === "object" && key !== null ? key.key : key;
		if (name === "email" || name === "message") errors[name] = FIELD_MESSAGES[name];
	}
	return errors;
}

/** A form field as a string, or empty when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/**
 * Renders the page inside the guides' shell: the form, or the thank-you once sent. The page is
 * left out of search results, since it answers no question of its own.
 */
async function renderContactPage(view: ContactView, init?: ResponseInit) {
	let ctx = getContext();
	let tree = await buildGuidesNav();
	let { values, errors, state } = view;
	let sent = state === "sent";
	let fields = sent ? null : await ctx.honeypot.issue();
	if (fields !== null && isFailure(fields))
		ctx.log.fail(fields.error, { docs_contact: "honeypot" });

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Contact — sdxc"
			description="Ask the author a question the guides did not answer."
			robots="noindex"
		>
			<DocsLayout tree={tree} activePath={routes.docs.contact.index.href()}>
				<DocsPageHeader
					crumbs={[
						{ label: "Documentation", href: routes.docs.index.href() },
						{ label: "Contact" },
					]}
					title={sent ? "Thanks, your message is on its way" : "Contact"}
					description={
						sent
							? "The reply comes from a person, to the address you gave, usually within a few days."
							: "Still stuck after reading the guides? Ask here and the reply goes to your inbox."
					}
				/>

				{sent ? (
					<p mix={[m("2rem", 0, 0, 0), text("base")]}>
						<a href={values.page || routes.docs.index.href()} mix={[fg("brand"), weight("medium")]}>
							{values.page ? "Back to the page you were reading" : "Back to the documentation"}
						</a>
					</p>
				) : (
					<form
						method="post"
						action={routes.docs.contact.action.href()}
						noValidate
						mix={[
							vstack({ gap: 5, align: "stretch" }),
							m("2rem", 0, 0, 0),
							raw({ maxInlineSize: "36rem" }),
						]}
					>
						{fields !== null && !isFailure(fields) ? <HoneypotFields {...fields.data} /> : null}
						<input type="hidden" name="page" value={values.page} />
						{state === "expired" || state === "failed" ? (
							<p role="alert" mix={[m(0), text("sm"), fg("warning")]}>
								{NOTICES[state]}
							</p>
						) : null}
						<TextField
							name="name"
							label="Name (optional)"
							defaultValue={values.name}
							autoComplete="name"
						/>
						<TextField
							type="email"
							name="email"
							label="Email"
							description="Where the reply should go."
							defaultValue={values.email}
							autoComplete="email"
							required
							color={errors.email ? "danger" : undefined}
							errorMessage={errors.email}
						/>
						<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							<Label htmlFor="docs-contact-message">Message</Label>
							<TextArea
								id="docs-contact-message"
								name="message"
								rows={6}
								required
								defaultValue={values.message}
								color={errors.message ? "danger" : undefined}
								aria-invalid={errors.message ? "true" : undefined}
								aria-describedby={errors.message ? "docs-contact-message-error" : undefined}
							/>
							{errors.message ? (
								<FieldError id="docs-contact-message-error">{errors.message}</FieldError>
							) : null}
						</div>
						<div>
							<Button type="submit" variant="solid" color="brand">
								Send message
							</Button>
						</div>
					</form>
				)}
			</DocsLayout>
		</DocumentLayout>,
		init,
	);
}

/** The `303` to the thank-you, still carrying the page the reader came from. */
function sentRedirect(page: string): Response {
	let params = new URLSearchParams({ [SENT_PARAM]: "1" });
	if (page) params.set("page", page);
	let location = `${routes.docs.contact.index.href()}?${params}`;
	return new Response(null, { status: 303, headers: { location } });
}

export default createController(routes.docs.contact, {
	actions: {
		/**
		 * GET /docs/contact — the empty form, keeping `?page=` only when it is a path on this
		 * site, or the thank-you after `?sent=1`.
		 */
		index(ctx) {
			let page = sameSitePath(ctx.url.searchParams.get("page") ?? "");
			let sent = ctx.url.searchParams.get(SENT_PARAM) === "1";
			return renderContactPage({
				values: { name: "", email: "", message: "", page },
				errors: {},
				state: sent ? "sent" : "form",
			});
		},

		/**
		 * POST /docs/contact — a trapped bot is thanked without an email, an expired or invalid
		 * form comes back (`400`), a valid one emails the inbox and redirects (`303`), and a
		 * failed delivery keeps the reader's words and names the inbox to write to (`502`).
		 */
		async action(ctx) {
			let values = {
				name: field(ctx.formData, "name"),
				email: field(ctx.formData, "email"),
				message: field(ctx.formData, "message"),
				page: sameSitePath(field(ctx.formData, "page")),
			};

			let trap = ctx.honeypotOutcome;
			if (isFailure(trap)) {
				ctx.log.set({ docs_contact: { refused: "honeypot", reason: trap.error.code } });
				if (trap.error.code === "expired" || trap.error.code === "too-fast") {
					return renderContactPage({ values, errors: {}, state: "expired" }, { status: 400 });
				}
				if (trap.error.code === "misconfigured") {
					return renderContactPage({ values, errors: {}, state: "failed" }, { status: 500 });
				}
				return sentRedirect(values.page);
			}

			let result = await validate(ctx.formData, DocsContactSchema);
			if (isFailure(result)) {
				return renderContactPage(
					{ values, errors: errorsOf(result.error), state: "form" },
					{ status: 400 },
				);
			}

			let { name, email, message, page } = result.data;
			let delivered = await ctx.email.send(emails.docsContact, {
				to: CONTACT_INBOX,
				replyTo: name ? { email, name } : { email },
				props: { name, email, message, page: page ? absoluteUrl(page) : "" },
			});
			if (isFailure(delivered)) {
				ctx.log.fail(delivered.error, { docs_contact: "send_failed" });
				return renderContactPage({ values, errors: {}, state: "failed" }, { status: 502 });
			}

			ctx.log.set({ docs_contact: { sent: true, page } });
			return sentRedirect(page);
		},
	},
});
