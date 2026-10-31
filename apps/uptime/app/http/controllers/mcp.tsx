/**
 * The page at `GET /mcp`: sells the agent surface with the mcp-bridge config itself, walks
 * through connecting a client, and hands a signed-in teammate the copy button and the way
 * to the dashboard where they mint a key carrying the `mcp` scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IntlProvider } from "@sdxc/i18n/ui";
import { ArrowRightIcon } from "@sdxc/icons";
import { flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	CodeStage,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import { CopyButton } from "~/resources/components/copy-button";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import ProductMockup from "~/resources/components/marketing/product-mockups";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/**
 * The mcp-bridge stdio config a visitor pastes into their agent. URL and auth header are the
 * product contract agents copy verbatim, so keep them literal rather than deriving them from
 * the request host or env at render time.
 */
const MCP_BRIDGE_CONFIG = {
	command: "npx",
	args: [
		"-y",
		"@sdxc/mcp@latest",
		"https://uptime.sergiodxa.com/mcp",
		"--header",
		"Authorization:Bearer ${UPTIME_MCP_TOKEN}",
	],
} as const;

/** Pretty-printed config JSON for the setup snippet. */
const MCP_BRIDGE_CONFIG_JSON = `${JSON.stringify(MCP_BRIDGE_CONFIG, null, 2)}\n`;

/** The connection steps, each a `mcp.setup.stepTitles.*` title over its `mcp.setup.steps.*` line. */
const SETUP_STEPS = ["token", "scopes", "configure", "ask"] as const;

/**
 * GET /mcp — the MCP landing. Every visitor sees the config and the steps; a signed-in
 * visitor also gets the copy button and the dashboard link in the hero, since they are the
 * one who can act on it now.
 */
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
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					entrance
					eyebrow={t("mcp.protocol.badge")}
					eyebrowVariant="pill"
					title={
						<>
							{t("mcp.hero.title")} <AccentText>{t("mcp.hero.highlight")}</AccentText>
						</>
					}
					description={t("mcp.hero.description")}
					actions={
						<div mix={[inlineFlex(), flexWrap(), items("center"), gap(3)]}>
							{isSignedIn ? (
								<>
									<LinkButton href={routes.app.index.href()} color="brand" size="lg">
										{t("mcp.setup.openKeys")}
										<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />
									</LinkButton>
									<IntlProvider intl={ctx.intl}>
										<CopyButton value={MCP_BRIDGE_CONFIG_JSON} label={t("mcp.setup.copy")} />
									</IntlProvider>
								</>
							) : (
								<AuthCta
									isSignedIn={false}
									startLabel={t("mcp.hero.ctaOut")}
									dashboardLabel={chrome.dashboardLabel}
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
								/>
							)}
						</div>
					}
					note={isSignedIn ? t("mcp.setup.scopesNote") : undefined}
					media={
						<CodeStage
							variant="code"
							name="uptime-mcp-config"
							tabs={[{ label: "mcp.json", content: MCP_BRIDGE_CONFIG_JSON, language: "json" }]}
						/>
					}
				/>

				<FeatureBand
					id="tools"
					layout="split"
					lean="media"
					eyebrow={t("mcp.tools.badge")}
					title={t("mcp.tools.title")}
					description={t("mcp.tools.description")}
					media={<ProductMockup area="api-keys" t={t} />}
					mix={[viewReveal()]}
				>
					<CheckList>
						<CheckRow>{t("mcp.tools.api")}</CheckRow>
						<CheckRow>{t("mcp.tools.scopes")}</CheckRow>
						<CheckRow>{t("mcp.tools.remote")}</CheckRow>
					</CheckList>
				</FeatureBand>

				<FeatureBand
					id="setup"
					layout="steps"
					tone="tinted"
					eyebrow={t("mcp.setup.badge")}
					title={t("mcp.setup.heading")}
					description={t("mcp.setup.lead")}
					mix={[viewReveal()]}
				>
					{SETUP_STEPS.map((step) => (
						<StepList.Item key={step} title={t(`mcp.setup.stepTitles.${step}`)}>
							{t(`mcp.setup.steps.${step}`)}
						</StepList.Item>
					))}
				</FeatureBand>

				<ClosingBand
					id="start"
					isSignedIn={isSignedIn}
					title={t("mcp.finalCta.title")}
					description={isSignedIn ? undefined : t("mcp.finalCta.body")}
					startLabel={t("mcp.finalCta.cta")}
					dashboardLabel={chrome.dashboardLabel}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
