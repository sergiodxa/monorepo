/**
 * The page at `GET /mcp`: sells the agent surface to anonymous visitors, and shows a
 * signed-in teammate how to point a client at this endpoint with an API key that carries
 * the `mcp` scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IntlProvider } from "@sdxc/i18n/ui";
import { bg, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { m, maxIs, mbs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { font, text, weight, whiteSpace } from "@sdxc/u/typography";
import { Description, Heading, HeadingScope, LinkButton, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import CopyButton from "~/resources/components/copy-button";
import AuthCta from "~/resources/components/marketing/auth-cta";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/**
 * The remote MCP client config a signed-in visitor pastes into their agent. Protocol and
 * URL are the product contract; keep them literal.
 */
const MCP_REMOTE_CONFIG = {
	command: "npx",
	args: [
		"-y",
		"@abluva/mcp-remote@latest",
		"--protocol",
		"2026-07-28",
		"https://uptime.sergiodxa.com/mcp",
	],
} as const;

/** Pretty-printed config JSON for the setup snippet. */
const MCP_REMOTE_CONFIG_JSON = `${JSON.stringify(MCP_REMOTE_CONFIG, null, 2)}\n`;

/** GET /mcp — marketing for anonymous visitors; setup instructions when signed in. */
export default createAction(routes.mcp.index, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("mcp.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("mcp.meta.description"),
				canonical: SEO.canonical(ctx.url),
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<article
					mix={[
						maxIs("720px"),
						m(0, "auto"),
						pbs("48px"),
						pi("24px"),
						pbe("80px"),
						vstack({ gap: 6 }),
					]}
				>
					<HeadingScope>
						<Heading level={1}>{t("mcp.heading")}</Heading>
						<Description>{t("mcp.description")}</Description>
					</HeadingScope>

					{isSignedIn ? (
						<section mix={[vstack({ gap: 4 })]}>
							<Heading level={2}>{t("mcp.setup.heading")}</Heading>
							<Description>{t("mcp.setup.lead")}</Description>

							<ol mix={[m(0), vstack({ gap: 2 }), text("sm"), fg("neutral")]}>
								<li>{t("mcp.setup.steps.token")}</li>
								<li>{t("mcp.setup.steps.scopes")}</li>
								<li>{t("mcp.setup.steps.configure")}</li>
								<li>{t("mcp.setup.steps.ask")}</li>
							</ol>

							<div mix={[vstack({ gap: 2 })]}>
								<Text mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>
									{t("mcp.setup.configLabel")}
								</Text>
								<pre
									mix={[
										m(0),
										p(3),
										rounded("md"),
										bg("neutral.tint"),
										fg("neutral.emphasis"),
										text("sm"),
										font("mono"),
										whiteSpace("pre-wrap"),
										overflow("auto"),
										maxIs("100%"),
									]}
								>
									<code>{MCP_REMOTE_CONFIG_JSON}</code>
								</pre>
								<IntlProvider intl={ctx.intl}>
									<CopyButton value={MCP_REMOTE_CONFIG_JSON} label={t("mcp.setup.copy")} />
								</IntlProvider>
							</div>

							<div mix={[mbs(2)]}>
								<LinkButton href={routes.app.index.href()} color="brand">
									{t("mcp.setup.openKeys")}
								</LinkButton>
							</div>
						</section>
					) : (
						<section
							mix={[
								vstack({ gap: 4 }),
								pbs(2),
								borderEdge("block-start", { color: "neutral.border", width: 1 }),
							]}
						>
							<Heading level={2}>{t("mcp.sell.heading")}</Heading>
							<Description>{t("mcp.sell.body")}</Description>
							<ul mix={[m(0), vstack({ gap: 2 }), text("sm"), fg("neutral")]}>
								<li>{t("mcp.sell.points.api")}</li>
								<li>{t("mcp.sell.points.scopes")}</li>
								<li>{t("mcp.sell.points.remote")}</li>
							</ul>
							<div>
								<AuthCta
									isSignedIn={false}
									startLabel={t("mcp.sell.cta")}
									dashboardLabel={t("landing.header.nav.cta.in")}
								/>
							</div>
						</section>
					)}
				</article>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
