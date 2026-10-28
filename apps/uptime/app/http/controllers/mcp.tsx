/**
 * The page at `GET /mcp`: sells the agent surface to anonymous visitors, and shows a
 * signed-in teammate how to point a client at this endpoint with an API key that carries
 * the `mcp` scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import McpLandingView from "~/resources/views/marketing/mcp";
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
				<McpLandingView
					isSignedIn={isSignedIn}
					brand={t("mcp.brand")}
					heroTitle={t("mcp.hero.title")}
					heroHighlight={t("mcp.hero.highlight")}
					heroDescription={t("mcp.hero.description")}
					heroCtaOut={t("mcp.hero.ctaOut")}
					heroCtaIn={t("mcp.hero.ctaIn")}
					signalLabel={t("mcp.hero.signalLabel")}
					endpoint={t("mcp.hero.endpoint")}
					protocol={t("mcp.hero.protocol")}
					protocolBadge={t("mcp.protocol.badge")}
					protocolTitle={t("mcp.protocol.title")}
					protocolDescription={t("mcp.protocol.description")}
					toolsBadge={t("mcp.tools.badge")}
					toolsTitle={t("mcp.tools.title")}
					toolsDescription={t("mcp.tools.description")}
					toolsApi={t("mcp.tools.api")}
					toolsScopes={t("mcp.tools.scopes")}
					toolsRemote={t("mcp.tools.remote")}
					setupBadge={t("mcp.setup.badge")}
					setupHeading={t("mcp.setup.heading")}
					setupLead={t("mcp.setup.lead")}
					setupSteps={[
						t("mcp.setup.steps.token"),
						t("mcp.setup.steps.scopes"),
						t("mcp.setup.steps.configure"),
						t("mcp.setup.steps.ask"),
					]}
					scopesNote={t("mcp.setup.scopesNote")}
					configLabel={t("mcp.setup.configLabel")}
					configJson={MCP_REMOTE_CONFIG_JSON}
					copyLabel={t("mcp.setup.copy")}
					openKeysLabel={t("mcp.setup.openKeys")}
					dashboardLabel={t("landing.header.nav.cta.in")}
					finalCtaTitle={t("mcp.finalCta.title")}
					finalCtaBody={t("mcp.finalCta.body")}
					finalCtaLabel={t("mcp.finalCta.cta")}
					intl={ctx.intl}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
