/**
 * Home controller for `/`. It explains what the reader is to a visitor who has not signed
 * in, and sends a signed-in one straight to their queue — the landing copy has nothing to
 * say to somebody who already has an account. It is also where `requireUser` redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { maxIs, mi, p } from "@sdxc/u/size";
import { fontSize, leading, textAlign } from "@sdxc/u/typography";
import { Button, Card, Heading, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import { isAuthenticated } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The landing page's three selling points, in the order they are rendered. */
const FEATURE_KEYS = ["queue", "private", "openWeb"] as const;

/**
 * The card row's track list. `auto-fit` rather than a breakpoint, so the three cards
 * collapse to one column on a phone and spread on a laptop from one declaration.
 */
const FEATURE_COLUMNS = "repeat(auto-fit, minmax(16rem, 1fr))";

/**
 * GET / — the landing page for a visitor, or a redirect to the queue for a signed-in
 * reader. The sign-in form is a `POST` because starting the flow writes the login
 * transaction into the session, and it stays a document navigation because the provider
 * answers with a cross-origin redirect no frame can follow.
 */
export default createAction(routes.home, (ctx) => {
	if (isAuthenticated()) {
		return redirect(routes.reading.href(), { status: redirect.Status.SeeOther });
	}

	return ctx.render(
		<DocumentLayout
			title={ctx.i18next.t("landing.meta.title")}
			description={ctx.i18next.t("landing.meta.description")}
			locale={ctx.locale}
		>
			<main mix={[vstack({ gap: 16 }), maxIs("64rem"), mi("auto"), p(8, 6)]}>
				<section mix={[vstack({ gap: 6, align: "center" }), textAlign("center"), p(12, 0)]}>
					<Heading level={1} mix={[fontSize("4xl"), leading("tight")]}>
						{ctx.i18next.t("landing.hero.title")}
					</Heading>

					<Text mix={[maxIs("42rem"), fontSize("lg"), leading("relaxed"), fg("neutral.muted")]}>
						{ctx.i18next.t("landing.hero.description")}
					</Text>

					<form method="post" action={routes.auth.action.href()} data-rmx-document="">
						<Button type="submit" size="lg">
							{ctx.i18next.t("landing.hero.cta")}
						</Button>
					</form>
				</section>

				<section mix={[grid(), gridTemplate({ columns: FEATURE_COLUMNS }), gap(6)]}>
					{FEATURE_KEYS.map((key) => (
						<Card key={key}>
							<Card.Header>
								<Card.Title>{ctx.i18next.t(`landing.features.${key}.title`)}</Card.Title>
								<Card.Description>
									{ctx.i18next.t(`landing.features.${key}.description`)}
								</Card.Description>
							</Card.Header>
						</Card>
					))}
				</section>
			</main>
		</DocumentLayout>,
	);
});
