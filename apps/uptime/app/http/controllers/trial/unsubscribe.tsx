/**
 * `/unsubscribe/:token` — the only credential a trial lead ever holds, since they never
 * made an account to sign in with.
 *
 * The GET only renders; only the POST deletes, since corporate link scanners and inbox
 * prefetchers follow every URL before a human sees it, and a GET that unsubscribed would
 * silently drop people who never clicked. The split also lets Gmail and Apple Mail's RFC
 * 8058 one-click button POST straight to this URL.
 *
 * Neither method reports whether a token exists — the GET never looks it up, and the POST
 * answers any token, used or not, with the same page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { getServiceContainer } from "@sdxc/service-container";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs, mi, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button, Card, Heading, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
		 * GET /unsubscribe/:token — renders the same confirmation page regardless of the token,
		 * so skipping the lookup keeps this method structurally incapable of the delete.
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
		 * reports it plainly: the answer to "do you still have my address?" becomes genuinely
		 * no. See `Lead.forget` for the reasoning behind the hard delete.
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
