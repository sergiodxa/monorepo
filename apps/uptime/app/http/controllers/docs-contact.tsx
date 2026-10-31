/**
 * `/docs/contact` is where a docs reader who is still stuck asks a person: a short form that
 * emails the support inbox with the reader's address as reply-to, so an answer goes straight
 * back to them. The page they came from rides along, so the question arrives with its context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { ValidationError } from "@sdxc/validate";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { redirect } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
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
import { getViewer } from "~/app/http/middleware/auth";
import { DocsContactSchema } from "~/app/http/validators/docs-contact";
import { SEO } from "~/app/initializers/seo";
import { recordCost } from "~/app/services/cost";
import { listDocs } from "~/app/services/docs";
import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The inbox every docs question lands in. */
const SUPPORT_INBOX = "hello+uptime@sergiodxa.com";

/** The fields a reader may get wrong, each with the message it shows. */
type FieldName = "email" | "message";

/** What the form shows: the reader's own words back, and which fields need another look. */
interface ContactView {
	values: { name: string; email: string; message: string; page: string };
	errors: Partial<Record<FieldName, string>>;
	sent: boolean;
	/** Set when the honeypot token expired, which asks the reader to send the form again. */
	expired?: boolean;
	/** Set when the email could not be sent, which asks the reader to try again or later. */
	failed?: boolean;
}

/** The message each field shows when it fails validation. */
function fieldMessages(t: Translate): Record<FieldName, string> {
	return {
		email: t("docs.contact.errors.email"),
		message: t("docs.contact.errors.message"),
	};
}

/** The fields a validation failure names, each mapped to its message. */
function errorsOf(error: ValidationError, t: Translate): ContactView["errors"] {
	let messages = fieldMessages(t);
	let errors: ContactView["errors"] = {};
	for (let issue of error.issues) {
		let key = issue.path?.[0];
		let name = typeof key === "object" && key !== null ? key.key : key;
		if (name === "email" || name === "message") errors[name] = messages[name];
	}
	return errors;
}

/** A form field as a string, or empty when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** Renders the page: the form, or the confirmation after a question was sent. */
async function renderContactPage(view: ContactView, init?: ResponseInit) {
	let ctx = getContext();
	let t = ctx.intl.t;
	let sections = await listDocs();
	let honeypot = unwrap(await ctx.honeypot.issue());
	let { values, errors } = view;

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${t("docs.contact.title")} | ${t("docs.meta.title")}`}
			locale={ctx.locale}
			seo={{
				canonical: SEO.canonical(new URL(routes.docs.contact.index.href(), ctx.url)),
				robots: SEO.robotsTag({ index: false, follow: true }),
			}}
		>
			<DocsLayout
				isSignedIn={getViewer() !== null}
				chrome={buildMarketingChrome(t)}
				sections={sections}
				activePath={routes.docs.contact.index.href()}
				labels={buildDocsLabels(t)}
			>
				<DocsPageHeader
					crumbsLabel={t("app.layout.breadcrumbs.label")}
					crumbs={[
						{ label: t("docs.shell.root"), href: routes.docs.index.href() },
						{ label: t("docs.contact.title") },
					]}
					title={view.sent ? t("docs.contact.sent.title") : t("docs.contact.title")}
					description={view.sent ? t("docs.contact.sent.body") : t("docs.contact.lead")}
				/>

				{view.sent ? (
					<p mix={[m(0), text("base")]}>
						<a href={values.page || routes.docs.index.href()} mix={[fg("brand"), weight("medium")]}>
							{values.page ? t("docs.contact.sent.back") : t("docs.contact.sent.hub")}
						</a>
					</p>
				) : (
					<form
						method="post"
						action={routes.docs.contact.action.href()}
						noValidate
						mix={[vstack({ gap: 5, align: "stretch" }), raw({ maxInlineSize: "36rem" })]}
					>
						<HoneypotFields {...honeypot} />
						<input type="hidden" name="page" value={values.page} />
						{view.expired || view.failed ? (
							<p role="alert" mix={[m(0), text("sm"), fg("warning")]}>
								{view.expired ? t("docs.contact.errors.expired") : t("docs.contact.errors.send")}
							</p>
						) : null}
						<TextField
							name="name"
							label={t("docs.contact.name")}
							defaultValue={values.name}
							autoComplete="name"
						/>
						<TextField
							type="email"
							name="email"
							label={t("docs.contact.email")}
							description={t("docs.contact.emailHint")}
							defaultValue={values.email}
							autoComplete="email"
							required
							color={errors.email ? "danger" : undefined}
							errorMessage={errors.email}
						/>
						<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							<Label htmlFor="docs-contact-message">{t("docs.contact.message")}</Label>
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
								{t("docs.contact.submit")}
							</Button>
						</div>
					</form>
				)}
			</DocsLayout>
		</DocumentLayout>,
		init,
	);
}

export default createController(routes.docs.contact, {
	actions: {
		/**
		 * GET /docs/contact — the empty form, with `?page=` carried from the page that linked
		 * here, or the confirmation after `?sent=1`.
		 */
		index(ctx) {
			let page = ctx.url.searchParams.get("page") ?? "";
			return renderContactPage({
				values: { name: "", email: "", message: "", page: page.startsWith("/docs") ? page : "" },
				errors: {},
				sent: ctx.url.searchParams.get("sent") === "1",
			});
		},

		/**
		 * POST /docs/contact — a filled honeypot gets the confirmation without an email, an
		 * expired token asks for a resend, an invalid form comes back with its errors, and a
		 * valid one emails the inbox with the reader as reply-to, then redirects with `303`.
		 */
		async action(ctx) {
			let t = ctx.intl.t;
			let values = {
				name: field(ctx.formData, "name"),
				email: field(ctx.formData, "email"),
				message: field(ctx.formData, "message"),
				page: field(ctx.formData, "page"),
			};
			let sent = redirect(
				`${routes.docs.contact.index.href()}?sent=1${values.page.startsWith("/docs") ? `&page=${encodeURIComponent(values.page)}` : ""}`,
				{ status: redirect.Status.SeeOther },
			);

			let trap = ctx.honeypotOutcome;
			if (isFailure(trap)) {
				ctx.log.set({ docs_contact: { refused: "honeypot", reason: trap.error.code } });
				if (trap.error.code === "trap-filled") return sent;
				return renderContactPage(
					{ values, errors: {}, sent: false, expired: true },
					{ status: 400 },
				);
			}

			let result = await validate(ctx.formData, DocsContactSchema);
			if (isFailure(result)) {
				return renderContactPage(
					{ values, errors: errorsOf(result.error, t), sent: false },
					{ status: 400 },
				);
			}

			let { name, email, message, page } = result.data;
			recordCost("emailSent");
			let delivered = await ctx.email.send(emails.docsContact, {
				to: SUPPORT_INBOX,
				replyTo: name ? { email, name } : { email },
				props: { name, email, message, page: page ? new URL(page, ctx.url.origin).href : "" },
			});
			if (isFailure(delivered)) {
				ctx.log.fail(delivered.error, { docs_contact: "send_failed" });
				return renderContactPage(
					{ values, errors: {}, sent: false, failed: true },
					{ status: 502 },
				);
			}

			ctx.log.set({ docs_contact: { sent: true, page } });
			return sent;
		},
	},
});
