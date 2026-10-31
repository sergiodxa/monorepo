/**
 * The support form at `/support`, the one way a reader reaches a person. A submission passes
 * the honeypot, the per-network limit, validation and the spam filter, then is mailed to the
 * support inbox with the sender as reply-to; the page then thanks them in place of the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Honeypot } from "@sdxc/honeypot";
import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { redirect } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import {
	Alert,
	Button,
	DocsPageHeader,
	FieldError,
	Form,
	Label,
	Select,
	TextArea,
	TextField,
} from "@sdxc/ui";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SupportInput } from "~/app/http/validators/support";
import type { AppContext } from "~/app/initializers/router";

import { getViewer, isAuthenticated } from "~/app/http/middleware/auth";
import {
	SUPPORT_LIMITS,
	SUPPORT_MESSAGE_MIN,
	SUPPORT_TOPICS,
	SupportSchema,
} from "~/app/http/validators/support";
import { landingTranslate } from "~/resources/components/marketing/figures";
import { findDocPage, pageTitle } from "~/resources/docs/registry";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The query naming the help page a reader came from, so support knows where they got stuck. */
export const SUPPORT_FROM_PARAM = "from";

/** The query the form redirects back with once a message is on its way. */
export const SUPPORT_SENT_PARAM = "sent";

/** Where the form stands: a fresh form, a thank-you, or the form back with what went wrong. */
type SupportState = "idle" | "sent" | "invalid" | "failed" | "rate-limited" | "resubmit";

/** What a returned form keeps, so nobody retypes a message because of a check. */
type SupportValues = Partial<Record<keyof SupportInput, string>>;

/** One refusal from validation, its message a key under `support.errors`. */
interface SupportIssue {
	message: string;
	path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

/** The fields a submission's values are read back from. */
const FIELDS = ["name", "email", "topic", "page", "message"] as const;

/** The submitted strings, as typed, for a form drawn again. */
function submittedValues(form: FormData | undefined): SupportValues {
	let values: SupportValues = {};
	for (let field of FIELDS) {
		let value = form?.get(field);
		if (typeof value === "string") values[field] = value;
	}
	return values;
}

/** The sender's network, which is what the burst limit counts per. */
function senderNetwork(request: Request): string {
	return request.headers.get("cf-connecting-ip") ?? "unknown";
}

namespace SupportPage {
	export interface Model {
		state: SupportState;
		values: SupportValues;
		issues: SupportIssue[];
		honeypot?: Honeypot.Fields;
	}
}

/** Draws the form, issuing fresh honeypot fields on every draw that shows it. */
async function renderPage(ctx: AppContext, model: SupportPage.Model, init?: ResponseInit) {
	let t = landingTranslate(ctx.intl, ctx.locale);
	let honeypot = model.state === "sent" ? undefined : unwrap(await ctx.honeypot.issue());

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${t("support.title")} · ${t("docs.title")}`}
			description={t("support.description")}
			locale={ctx.locale}
		>
			<DocsLayout t={t} isSignedIn={isAuthenticated()} activePath={routes.support.index.href()}>
				<DocsPageHeader
					crumbsLabel={t("docs.nav.crumbs")}
					crumbs={[
						{ label: t("docs.eyebrow"), href: routes.docs.index.href() },
						{ label: t("support.title") },
					]}
					title={t("support.title")}
					description={t("support.description")}
					mix={[raw({ marginBlockEnd: "0.75rem" })]}
				/>
				<SupportForm t={t} {...model} honeypot={honeypot} />
			</DocsLayout>
		</DocumentLayout>,
		init,
	);
}

export default createController(routes.support, {
	actions: {
		/**
		 * The form, filled with a signed-in reader's email and the help page they came from,
		 * or the thanks once a message was sent.
		 */
		index(ctx) {
			if (ctx.url.searchParams.get(SUPPORT_SENT_PARAM) === "1") {
				return renderPage(ctx, { state: "sent", values: {}, issues: [] });
			}
			let from = ctx.url.searchParams.get(SUPPORT_FROM_PARAM) ?? "";
			return renderPage(ctx, {
				state: "idle",
				values: {
					email: getViewer()?.email ?? "",
					page: findDocPage(from) ? from : "",
				},
				issues: [],
			});
		},

		/**
		 * Mails a submission. A filled trap and a spam verdict land on the thanks as if sent,
		 * so a bot learns nothing; everything else returns the form with the message kept.
		 */
		async action(ctx) {
			let form = ctx.get(FormData);
			let values = submittedValues(form);
			let sent = redirect(
				`${routes.support.index.href()}?${new URLSearchParams({ [SUPPORT_SENT_PARAM]: "1" })}`,
				{ status: redirect.Status.SeeOther },
			);

			let trap = ctx.honeypotOutcome;
			if (isFailure(trap)) {
				ctx.log.set({ support: { outcome: "honeypot", reason: trap.error.code } });
				if (trap.error.code === "trap-filled") return sent;
				return renderPage(ctx, { state: "resubmit", values, issues: [] }, { status: 400 });
			}

			if (!(await ctx.supportDesk.admit(senderNetwork(ctx.request)))) {
				ctx.log.set({ support: { outcome: "rate_limited" } });
				return renderPage(
					ctx,
					{ state: "rate-limited", values, issues: [] },
					{ status: 429, headers: { "retry-after": "60" } },
				);
			}

			let parsed = await validate(form ?? new FormData(), SupportSchema);
			if (isFailure(parsed)) {
				ctx.log.set({ support: { outcome: "invalid" } });
				return renderPage(
					ctx,
					{ state: "invalid", values, issues: [...parsed.error.issues] },
					{ status: 400 },
				);
			}

			let sender = {
				ip: senderNetwork(ctx.request),
				userAgent: ctx.request.headers.get("user-agent") ?? undefined,
				renderedAt: trap.data.renderedAt,
				signedIn: isAuthenticated(),
			};
			let assessment = await ctx.supportDesk.assess(parsed.data, sender);
			ctx.log.set({ spam: { verdict: assessment.verdict, score: assessment.score } });
			if (assessment.verdict === "spam") {
				ctx.log.set({ support: { outcome: "spam" } });
				return sent;
			}

			let delivered = await ctx.supportDesk.deliver(parsed.data, sender);
			if (isFailure(delivered)) {
				ctx.log.warn("support.delivery_failed", { reason: delivered.error.reason });
				return renderPage(ctx, { state: "failed", values, issues: [] }, { status: 503 });
			}

			ctx.log.set({ support: { outcome: "delivered", topic: parsed.data.topic } });
			return sent;
		},
	},
});

/** The first issue a field has, translated, or `undefined` when it has none. */
function issueFor(t: Translate, issues: SupportIssue[], name: string): string | undefined {
	let issue = issues.find((candidate) => {
		let head = candidate.path?.[0];
		let key = typeof head === "object" && head !== null ? head.key : head;
		return key === name;
	});
	return issue ? t(issue.message) : undefined;
}

/** The form itself, or the thanks in its place once a message was sent. */
function SupportForm(handle: Handle<SupportPage.Model & { t: Translate }>) {
	return () => {
		let { honeypot, issues, state, t, values } = handle.props;

		if (state === "sent") {
			return (
				<div mix={[raw({ display: "grid", gap: "1rem" })]}>
					<Alert color="success" live="polite">
						<Alert.Content>
							<Alert.Description>{t("support.states.sent")}</Alert.Description>
						</Alert.Content>
					</Alert>
					<p mix={[m(0)]}>
						<a href={routes.support.index.href()}>{t("support.states.another")}</a>
					</p>
				</div>
			);
		}

		let translated = issues.map((issue) => ({ ...issue, message: t(issue.message) }));
		let topicError = issueFor(t, issues, "topic");
		let messageError = issueFor(t, issues, "message");
		let notice = {
			invalid: ["danger", "support.states.invalid"],
			failed: ["danger", "support.states.failed"],
			"rate-limited": ["warning", "support.states.rateLimited"],
			resubmit: ["warning", "support.states.resubmit"],
			idle: null,
		}[state] as ["danger" | "warning", string] | null;

		return (
			<Form
				method="post"
				action={routes.support.action.href()}
				issues={translated}
				mix={[raw({ display: "grid", gap: "1.25rem", maxInlineSize: "36rem" })]}
			>
				{notice ? (
					<Alert color={notice[0]} live="assertive">
						<Alert.Content>
							<Alert.Description>{t(notice[1])}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				{values.page && findDocPage(values.page) ? (
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						{t("support.from", { page: pageTitle(t, values.page) })}
					</p>
				) : null}
				<input type="hidden" name="page" value={values.page ?? ""} />

				<TextField
					label={t("support.name")}
					name="name"
					autoComplete="name"
					maxLength={SUPPORT_LIMITS.name}
					defaultValue={values.name}
				/>
				<TextField
					label={t("support.email")}
					description={t("support.emailHint")}
					name="email"
					type="email"
					autoComplete="email"
					required
					maxLength={SUPPORT_LIMITS.email}
					defaultValue={values.email}
				/>

				<div mix={[raw({ display: "grid", gap: "0.5rem" })]}>
					<Label htmlFor="support-topic">{t("support.topic")}</Label>
					<Select
						id="support-topic"
						name="topic"
						required
						color={topicError ? "danger" : undefined}
						aria-invalid={topicError ? "true" : undefined}
						aria-describedby={topicError ? "support-topic-error" : undefined}
					>
						<Select.Option value="" selected={!values.topic}>
							{t("support.topicPlaceholder")}
						</Select.Option>
						{SUPPORT_TOPICS.map((topic) => (
							<Select.Option key={topic} value={topic} selected={values.topic === topic}>
								{t(`support.topics.${topic}`)}
							</Select.Option>
						))}
					</Select>
					{topicError ? <FieldError id="support-topic-error">{topicError}</FieldError> : null}
				</div>

				<div mix={[raw({ display: "grid", gap: "0.5rem" })]}>
					<Label htmlFor="support-message">{t("support.message")}</Label>
					<TextArea
						id="support-message"
						name="message"
						required
						minLength={SUPPORT_MESSAGE_MIN}
						maxLength={SUPPORT_LIMITS.message}
						rows={8}
						placeholder={t("support.messagePlaceholder")}
						color={messageError ? "danger" : undefined}
						aria-invalid={messageError ? "true" : undefined}
						aria-describedby={messageError ? "support-message-error" : undefined}
						defaultValue={values.message}
					/>
					{messageError ? <FieldError id="support-message-error">{messageError}</FieldError> : null}
				</div>

				{honeypot ? <HoneypotFields {...honeypot} /> : null}

				<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{t("support.privacy")}</p>
				<div>
					<Button type="submit">{t("support.send")}</Button>
				</div>
			</Form>
		);
	};
}
