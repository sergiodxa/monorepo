/**
 * `/digests/unsubscribe/:token` — the one-click way out of a team digest, which works with no
 * session because the signed token in the URL names the member and the digest. The GET only
 * renders a confirmation; the POST, which RFC 8058 mailbox providers send, does the turning off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { m, maxIs, mi, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button, Card, Heading, LinkButton, Text } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import UserPreferences from "~/app/data/user-preferences";
import { verifyDigestUnsubscribeToken } from "~/app/lib/digest-unsubscribe";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The one path param, parsed the way every other controller reads one. */
const ParamsSchema = s.object({ token: s.string() });

/**
 * The centered single-purpose page every answer here uses, differing only in copy, status,
 * and the control under it.
 *
 * @param copy - Heading, which doubles as the document title, and the paragraph under it.
 * @param footer - The button or link the page offers.
 * @param status - HTTP status of the response.
 * @returns The rendered document.
 */
function renderPage(copy: { title: string; body: string }, footer: RemixNode, status = 200) {
	let ctx = getContext();

	return ctx.render(
		<DocumentLayout title={copy.title} locale={ctx.locale}>
			<main mix={[vstack({ gap: 8, align: "center", justify: "center" }), minBs("100vh"), p(8)]}>
				<Card mix={[maxIs("560px"), mi("auto")]}>
					<Card.Content mix={[vstack({ gap: 5, align: "center" }), textAlign("center"), p(10, 8)]}>
						<Heading level={1} mix={[m(0)]}>
							{copy.title}
						</Heading>
						<Text>{copy.body}</Text>
						{footer}
					</Card.Content>
				</Card>
			</main>
		</DocumentLayout>,
		{ status },
	);
}

/**
 * The answer to a token that fails verification: a 400 with a way home, since a forged or
 * truncated link authorizes nothing and the reader can still switch digests off after signing in.
 */
function renderInvalid() {
	let t = getContext().intl.t;

	return renderPage(
		{
			title: t("page.digestUnsubscribe.invalid.title"),
			body: t("page.digestUnsubscribe.invalid.body"),
		},
		<LinkButton href={routes.home.href()} color="neutral" variant="outline">
			{t("page.digestUnsubscribe.invalid.cta")}
		</LinkButton>,
		400,
	);
}

export default createController(routes.digestUnsubscribe, {
	actions: {
		/**
		 * GET /digests/unsubscribe/:token — verifies the token and asks for confirmation with a
		 * button that POSTs back here, writing nothing, so a link scanner's visit changes nothing.
		 */
		async index(ctx) {
			let { token } = s.parse(ParamsSchema, ctx.params);
			let t = ctx.intl.t;

			if (!(await verifyDigestUnsubscribeToken(token))) return renderInvalid();

			return renderPage(
				{
					title: t("page.digestUnsubscribe.confirm.title"),
					body: t("page.digestUnsubscribe.confirm.body"),
				},
				<form method="post" action={routes.digestUnsubscribe.action.href({ token })}>
					<Button type="submit" color="danger">
						{t("page.digestUnsubscribe.confirm.cta")}
					</Button>
				</form>,
			);
		},

		/**
		 * POST /digests/unsubscribe/:token — turns the named digest off for the member the token
		 * names, answering a repeat the same way as the first, as a provider retry expects.
		 */
		async action(ctx) {
			let { token } = s.parse(ParamsSchema, ctx.params);
			let t = ctx.intl.t;

			let unsubscribe = await verifyDigestUnsubscribeToken(token);
			if (!unsubscribe) return renderInvalid();

			await UserPreferences.unsubscribe(ctx.db, unsubscribe.subjectId, unsubscribe.email);

			return renderPage(
				{
					title: t("page.digestUnsubscribe.done.title"),
					body: t("page.digestUnsubscribe.done.body"),
				},
				<LinkButton href={routes.home.href()} color="neutral" variant="outline">
					{t("page.digestUnsubscribe.done.cta")}
				</LinkButton>,
			);
		},
	},
});
