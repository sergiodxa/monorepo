/**
 * HTTP controller for the press kit: the designed page at `/press`, the invitations its form
 * posts back to the same address, and the kit as Markdown at `/press.md`. Each answers in the
 * reader's language, English or Spanish, from the same structured kit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { redirect } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction, createController } from "remix/router";
import { Session } from "remix/session";

import type { AppContext } from "~/app/initializers/router";
import type { PressKit } from "~/app/services/press-kit";

import { PressContactSchema } from "~/app/http/validators/press-contact";
import { resolvePageLocale } from "~/app/services/page-locale";
import { pressKitFor, pressKitMarkdown } from "~/app/services/press-kit";
import { PressView } from "~/resources/views/press";
import routes from "~/routes/web";

/** The flash key carrying a successful delivery across the redirect to the confirmation. */
const SENT_FLASH = "pressContactSent";

/** The fields the form posts, which a failed submission hands back to the view verbatim. */
const FIELDS = ["name", "email", "kind", "event", "message"] as const;

/** The kit in the request's language, from `?lang=` or `Accept-Language`. */
function kitFor(ctx: AppContext): PressKit {
	return pressKitFor(resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language")));
}

/** Builds a Markdown response with the site's Markdown content type. */
function markdown(body: string): Response {
	return new Response(body, {
		headers: { "Content-Type": ct.Markdown, Vary: "Accept, Accept-Language" },
	});
}

/** Where the form's outcome lands: the kit in its language, scrolled to the form. */
function contactHref(kit: PressKit): string {
	return `${routes.press.index.href()}?lang=${kit.locale}#contact`;
}

/**
 * Reads the submitted values as posted, before validation trims or rejects them, so a
 * re-rendered form shows exactly what the organizer typed.
 */
function submittedValues(form: FormData | undefined): PressView.Values {
	let values: PressView.Values = {};
	for (let field of FIELDS) {
		let value = form?.get(field);
		if (typeof value === "string") values[field] = value;
	}
	return values;
}

/**
 * Words each issue in the kit's language, one message per field, since the validator's own
 * messages are written for the logs.
 */
function localizedIssues(
	issues: ReadonlyArray<Form.Issue>,
	kit: PressKit,
): ReadonlyArray<Form.Issue> {
	return issues.map((issue) => {
		let segment = issue.path?.[0];
		let key = String(typeof segment === "object" ? segment.key : segment);
		let message = kit.contact.errors[key as keyof PressKit.Contact["errors"]];
		return message ? { ...issue, message } : issue;
	});
}

/**
 * Renders the page in `state` with freshly issued honeypot fields, so every re-render carries
 * a token as valid as the first page load's.
 */
async function renderPage(
	ctx: AppContext,
	model: Omit<PressView.Model, "honeypot">,
	init?: ResponseInit,
): Promise<Response> {
	let honeypot = unwrap(await ctx.honeypot.issue());
	return ctx.render(PressView, { ...model, honeypot }, init);
}

/**
 * The press kit page. Public and anonymous; the cross-origin guard, honeypot and support desk
 * run ahead of it. The page carries a per-render honeypot token, so it is never cached.
 */
export default createController(routes.press, {
	actions: {
		/**
		 * Renders the kit, as Markdown when the request prefers it, or with the confirmation
		 * when the previous request delivered an invitation.
		 *
		 * @returns The press kit page or its Markdown.
		 */
		index: async (ctx) => {
			let kit = kitFor(ctx);
			if (accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown) {
				return markdown(pressKitMarkdown(kit, ctx.url.origin));
			}

			let sent = ctx.get(Session).get(SENT_FLASH) === true;
			if (sent) return ctx.render(PressView, { kit, state: "sent", values: {}, issues: [] });
			return renderPage(ctx, { kit, state: "idle", values: {}, issues: [] });
		},

		/**
		 * Handles an invitation. A filled trap answers like a success without sending, so a bot
		 * learns nothing; a spam verdict does the same, and every other failure re-renders the
		 * form with what the organizer typed.
		 *
		 * @returns A See Other redirect to the confirmation, or the page with a 4xx/5xx status.
		 */
		action: async (ctx) => {
			let kit = kitFor(ctx);
			let form = ctx.get(FormData);
			let values = submittedValues(form);
			let session = ctx.get(Session);
			let confirm = () => {
				session.flash(SENT_FLASH, true);
				return redirect(contactHref(kit), { status: redirect.Status.SeeOther });
			};

			let trap = ctx.honeypotOutcome;
			if (isFailure(trap)) {
				ctx.log.set({ press: { outcome: "honeypot", reason: trap.error.code } });
				if (trap.error.code === "trap-filled") return confirm();
				return renderPage(ctx, { kit, state: "resubmit", values, issues: [] }, { status: 400 });
			}

			let admitted = await ctx.supportDesk.admit(
				ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? "unknown",
			);
			if (!admitted) {
				ctx.log.set({ press: { outcome: "rate_limited" } });
				return renderPage(
					ctx,
					{ kit, state: "rate-limited", values, issues: [] },
					{ status: 429, headers: { "retry-after": "60" } },
				);
			}

			let parsed = await validate(form ?? new FormData(), PressContactSchema);
			if (isFailure(parsed)) {
				ctx.log.set({ press: { outcome: "invalid" } });
				let issues = localizedIssues(parsed.error.issues, kit);
				return renderPage(ctx, { kit, state: "invalid", values, issues }, { status: 400 });
			}

			let assessment = await ctx.supportDesk.assess(parsed.data, {
				ip: ctx.ip?.toString(),
				userAgent: ctx.request.headers.get("user-agent") ?? undefined,
				renderedAt: trap.data.renderedAt,
			});
			ctx.log.set({
				spam: {
					verdict: assessment.verdict,
					score: assessment.score,
					signals: assessment.signals.map((signal) => signal.check).join(","),
				},
			});
			if (assessment.verdict === "spam") {
				ctx.log.set({ press: { outcome: "spam" } });
				return confirm();
			}

			let delivered = await ctx.supportDesk.deliverInvitation(parsed.data, kit.locale, assessment);
			if (isFailure(delivered)) {
				ctx.log.warn("press.delivery_failed", { reason: delivered.error.reason });
				return renderPage(ctx, { kit, state: "failed", values, issues: [] }, { status: 503 });
			}

			ctx.log.set({ press: { outcome: "delivered", kind: parsed.data.kind } });
			return confirm();
		},
	},
});

/**
 * Serves the kit as Markdown whatever the request accepts; the extension is an explicit
 * request, so it overrides negotiation. `?lang=` picks the language as on the page.
 *
 * @returns The kit's Markdown.
 */
export const markdownPage = createAction(routes.pressMarkdown, async (ctx) =>
	markdown(pressKitMarkdown(kitFor(ctx), ctx.url.origin)),
);
