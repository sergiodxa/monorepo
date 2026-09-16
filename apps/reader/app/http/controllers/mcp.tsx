/**
 * The page at `GET /mcp`, explaining what answers a `POST` to the same address: what the
 * server offers, what a token is, and what a client has to be able to do to connect.
 *
 * It answers a `GET` because a person who pastes an endpoint into a browser should find out
 * what it is rather than a method refusal — and because the limit worth stating plainly is
 * the one this page states: a client that can only speak OAuth cannot connect here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs, p, pbs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Description, LinkButton, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import { chrome } from "~/app/http/controllers/chrome";
import requireUser from "~/app/http/middleware/require-user";
import AppLayout, { PAGE_COLUMN } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The three things the page says about connecting, each one sentence in the dictionary. */
const STEPS = ["mint", "configure", "ask"] as const;

/** GET /mcp — what answers an agent at this address, and how to point one at it. */
export default createAction(routes.mcp.index, {
	middleware: [requireUser],
	async handler(ctx) {
		let endpoint = new URL(routes.mcp.index.href(), ctx.url).toString();

		return ctx.render(
			<AppLayout
				documentTitle={ctx.i18next.t("agent.page.title")}
				heading={ctx.i18next.t("agent.page.heading")}
				locale={ctx.locale}
				{...await chrome(ctx)}
			>
				<section mix={[vstack({ gap: 3 }), maxIs(PAGE_COLUMN)]}>
					<Description>{ctx.i18next.t("agent.page.description")}</Description>

					<Text
						mix={[
							m(0),
							p(3),
							rounded("md"),
							bg("neutral.tint"),
							fg("neutral.emphasis"),
							text("sm"),
							weight("medium"),
							maxIs("100%"),
						]}
					>
						<code>{endpoint}</code>
					</Text>

					<ol mix={[m(0), vstack({ gap: 2 })]}>
						{STEPS.map((step) => (
							<li key={step} mix={[text("sm"), fg("neutral")]}>
								{ctx.i18next.t(`agent.page.steps.${step}`)}
							</li>
						))}
					</ol>
				</section>

				{/**
				 * The limit stated where somebody meets it, rather than discovered as a hang: a
				 * client that can only start an OAuth flow finds nothing here to start one with.
				 */}
				<section
					mix={[
						vstack({ gap: 3 }),
						maxIs(PAGE_COLUMN),
						pbs(6),
						borderEdge("block-start", { color: "neutral.border", width: 1 }),
					]}
				>
					{/** Level 2, since the layout's own page heading is the document's only `h1`. */}
					<h2 mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
						{ctx.i18next.t("agent.page.clients.legend")}
					</h2>

					<Description>{ctx.i18next.t("agent.page.clients.description")}</Description>

					<div>
						<LinkButton href={routes.settings.href()} color="neutral" variant="outline">
							{ctx.i18next.t("agent.page.clients.tokens")}
						</LinkButton>
					</div>
				</section>
			</AppLayout>,
		);
	},
});
