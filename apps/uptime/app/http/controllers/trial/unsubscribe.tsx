/**
 * `/unsubscribe/:token` — the only credential a trial lead will ever hold, and the only
 * way they have to make the emails stop. They never made an account, so there is nothing
 * to sign in with; the unguessable token in the URL is the whole proof.
 *
 * **The GET renders a page and deletes nothing.** Corporate link scanners and inbox
 * fetchers — Outlook Safe Links, Gmail's own prefetch — follow every URL in a message
 * before a human has seen it, so a GET that unsubscribed would silently delete the leads
 * of people who never clicked anything. Only the POST deletes. That split is also what
 * makes the RFC 8058 one-click button work: Gmail and Apple Mail POST to this same URL,
 * so those readers still get their single click.
 *
 * **Neither method ever reports whether a token exists.** The GET renders its confirmation
 * without looking the token up at all, and the POST renders the same "you're unsubscribed"
 * page whether it deleted a lead, found nothing, or was handed a token that was already
 * used. A 404 here would turn the URL into an oracle for guessing which tokens are live,
 * and there is nothing an honest reader gains from the distinction: a second click on a
 * link that lives in an inbox forever should say what the first one said.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { getServiceContainer } from "@pkg/service-container";
import { vstack } from "@pkg/u/layout";
import { m, maxIs, mi, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { Button, Card, Heading, LinkButton, Text } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import Lead from "~/app/data/lead";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one path param, as a schema so it is read the same way every other controller reads one. */
const ParamsSchema = s.object({ token: s.string() });

/**
 * The centered single-purpose page both methods answer with, differing only in copy and
 * in what sits under it.
 *
 * @param title - Heading and document title.
 * @param body - The one paragraph under the heading.
 * @param locale - Language the page is being served in.
 * @param footer - The button or link the page offers, if any.
 * @returns The rendered document.
 */
function renderPage(title: string, body: string, locale: string, footer: RemixNode) {
	let ctx = getContext();

	return ctx.render(
		<DocumentLayout title={title} locale={locale}>
			<main mix={[vstack({ gap: 8, align: "center", justify: "center" }), minBs("100vh"), p(8)]}>
				<Card mix={[maxIs("560px"), mi("auto")]}>
					<Card.Content mix={[vstack({ gap: 5, align: "center" }), textAlign("center"), p(10, 8)]}>
						<Heading level={1} mix={[m(0)]}>
							{title}
						</Heading>
						<Text>{body}</Text>
						{footer}
					</Card.Content>
				</Card>
			</main>
		</DocumentLayout>,
	);
}

export default createController(routes.trial.unsubscribe, {
	actions: {
		/**
		 * GET /unsubscribe/:token — asks, and does nothing else. The token is not looked up:
		 * there is nothing to render differently for an unknown one, and not reading it is
		 * the simplest way to be sure this method can never be the one that deletes.
		 */
		index(ctx) {
			let { token } = s.parse(ParamsSchema, ctx.params);
			let t = ctx.i18next.t;

			return renderPage(
				t("page.unsubscribe.confirm.title"),
				t("page.unsubscribe.confirm.body"),
				ctx.locale,
				<form method="post" action={routes.trial.unsubscribe.action.href({ token })}>
					<Button type="submit" color="danger">
						{t("page.unsubscribe.confirm.cta")}
					</Button>
				</form>,
			);
		},

		/**
		 * POST /unsubscribe/:token — deletes the lead and everything attached to it, then
		 * says so. A hard delete rather than a suppression list, so the answer to "do you
		 * still have my address?" is no; see `Lead.forget` for why that is the right trade.
		 */
		async action(ctx) {
			let { token } = s.parse(ParamsSchema, ctx.params);
			let t = ctx.i18next.t;

			let db = getServiceContainer().get(Database);
			let lead = await Lead.findByUnsubscribeToken(db, token);
			if (lead) await Lead.forget(db, lead.id);

			return renderPage(
				t("page.unsubscribe.done.title"),
				t("page.unsubscribe.done.body"),
				ctx.locale,
				<LinkButton href={routes.home.href()} color="neutral" variant="outline">
					{t("page.unsubscribe.done.cta")}
				</LinkButton>,
			);
		},
	},
});
