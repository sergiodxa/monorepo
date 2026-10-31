/**
 * Shared header and footer chrome that every public marketing page composes its content
 * into: the home, features, comparisons, use cases, docs and legal pages share this layout,
 * so a visitor finds the same destinations, in the same places, on every page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import {
	ActivityIcon,
	AppWindowIcon,
	BellIcon,
	BotIcon,
	ChartLineIcon,
	CirclePauseIcon,
	ClockIcon,
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	LinkIcon,
	LockIcon,
	MessageSquareIcon,
	UsersIcon,
	WorkflowIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, minBs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, tracking, weight } from "@sdxc/u/typography";
import { SiteFooter, SiteHeader } from "@sdxc/ui/patterns";
import { marketingContainer } from "@sdxc/ui/styles";

import { BRAND_MARK_PATHS } from "~/config/brand";
import AuthCta from "~/resources/components/marketing/auth-cta";
import { SheetDismiss } from "~/resources/components/marketing/sheet-dismiss";
import routes from "~/routes/web";

/**
 * Uptime's marketing register over its own palette, which `colors.css` already declares on
 * the root: mono uppercase eyebrows in the brand ink, like the product's own labels, and
 * the shared marketing defaults for everything else. Pages inside the layout inherit these.
 */
const MARKETING_TOKENS = {
	"--ui-marketing-eyebrow-font": "var(--ui-font-mono)",
	"--ui-marketing-eyebrow-weight": "500",
	"--ui-marketing-eyebrow-transform": "uppercase",
	"--ui-marketing-eyebrow-tracking": "0.08em",
	"--ui-marketing-eyebrow-color": "var(--ui-brand-fg)",
} as const;

namespace MarketingLayout {
	export interface Props {
		isSignedIn: boolean;
		/** Wordmark beside the brand mark, linking home (`landing.header.title`). */
		brandLabel: string;
		/** Header destinations, already translated and pointed at their `routes.*` hrefs. */
		headerItems: SiteHeader.Item[];
		/** Accessible names for the header's navigation, menu button and sheet close button. */
		headerLabels: { nav: string; open: string; close: string };
		/** Label for the header CTA's signed-in state (`landing.header.nav.cta.in`). */
		dashboardLabel: string;
		/** Label for the header CTA's signed-out state (`landing.header.nav.cta.out`). */
		startLabel: string;
		/** Footer columns, already translated and pointed at their `routes.*` hrefs. */
		footerColumns: SiteFooter.Column[];
		/** Terms, privacy and trust, set in the footer's bottom row beside the copyright. */
		legalLinks: SiteFooter.Link[];
		/** One line under the footer's brand mark (`landing.footer.description`). */
		tagline: string;
		/** Fully formatted copyright line (`landing.footer.copyright`, year already interpolated). */
		copyrightLine: string;
		children: RemixNode;
	}
}

/**
 * Builds every translated prop {@link MarketingLayout} needs from a controller's own
 * `ctx.intl.t`, so which label pairs with which `routes.*` href is decided once, here.
 *
 * @example
 * let chrome = buildMarketingChrome(ctx.intl.t);
 * return ctx.render(
 * 	<DocumentLayout assets={ctx.assets} title={...}>
 * 		<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
 * 			{...}
 * 		</MarketingLayout>
 * 	</DocumentLayout>,
 * );
 */
export function buildMarketingChrome(
	t: Translate,
): Omit<MarketingLayout.Props, "isSignedIn" | "children"> {
	let feature = (slug: string) => routes.marketing.feature.href({ slug });
	let useCase = (slug: string) => routes.marketing.useCase.href({ slug });
	let audience = (slug: string) => routes.marketing.audience.href({ slug });
	let comparison = (slug: string) => routes.marketing.comparison.href({ slug });
	let label = (key: string) => t(`landing.footer.sections.${key}`);

	let featureLinks = {
		monitors: { label: label("features.monitors"), href: feature("monitors") },
		alerts: { label: label("features.alerts"), href: feature("alerts") },
		statusPages: { label: label("features.statusPages"), href: feature("status-pages") },
		ssl: { label: label("features.ssl"), href: feature("ssl") },
		dns: { label: label("features.dns"), href: feature("dns") },
		cronJobs: { label: label("features.cronJobs"), href: feature("cron-jobs") },
		content: { label: label("features.contentMonitoring"), href: feature("content-monitoring") },
		maintenance: { label: label("features.maintenance"), href: feature("maintenance") },
		integrations: { label: label("features.integrations"), href: feature("integrations") },
		teams: { label: label("features.teams"), href: feature("teams") },
		analytics: { label: label("features.analytics"), href: feature("analytics") },
		api: { label: label("features.api"), href: feature("api") },
		flows: { label: label("features.flowMonitors"), href: feature("flows") },
		browserFlows: { label: label("features.browserFlows"), href: routes.browserFlows.href() },
	};

	let useCaseLinks: SiteFooter.Link[] = [
		{ label: label("useCases.websiteMonitoring"), href: useCase("website-monitoring") },
		{ label: label("useCases.apiMonitoring"), href: useCase("api-monitoring") },
		{ label: label("useCases.saas"), href: useCase("saas") },
		{ label: label("useCases.ecommerce"), href: useCase("ecommerce") },
		{ label: label("useCases.cronJobs"), href: useCase("cron-jobs") },
		{ label: label("useCases.microservices"), href: useCase("microservices") },
		{ label: label("useCases.healthChecks"), href: useCase("healthcheck") },
		{ label: label("useCases.loginFlows"), href: useCase("login-flow-monitoring") },
	];

	let audienceLinks: SiteFooter.Link[] = [
		{ label: label("solutions.indieHackers"), href: audience("indie-hackers") },
		{ label: label("solutions.soloDevs"), href: audience("solo-devs") },
		{ label: label("solutions.startups"), href: audience("startups") },
		{ label: label("solutions.agencies"), href: audience("agencies") },
		{ label: label("solutions.enterprises"), href: audience("enterprises") },
		{ label: label("solutions.devops"), href: audience("devops") },
	];

	let mcpLink = { label: label("docs.mcp"), href: routes.mcp.index.href() };

	let headerItems: SiteHeader.Item[] = [
		{
			label: t("landing.header.nav.features"),
			columns: [
				{
					title: t("landing.header.groups.features.checks"),
					links: [
						{ ...featureLinks.monitors, icon: <ActivityIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.dns, icon: <LinkIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.ssl, icon: <LockIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.cronJobs, icon: <ClockIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.content, icon: <FileTextIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.flows, icon: <WorkflowIcon size={20} aria-hidden="true" /> },
						{
							...featureLinks.browserFlows,
							icon: <AppWindowIcon size={20} aria-hidden="true" />,
						},
					],
				},
				{
					title: t("landing.header.groups.features.respond"),
					links: [
						{ ...featureLinks.alerts, icon: <BellIcon size={20} aria-hidden="true" /> },
						{
							...featureLinks.integrations,
							icon: <MessageSquareIcon size={20} aria-hidden="true" />,
						},
						{ ...featureLinks.statusPages, icon: <GlobeIcon size={20} aria-hidden="true" /> },
						{
							...featureLinks.maintenance,
							icon: <CirclePauseIcon size={20} aria-hidden="true" />,
						},
					],
				},
				{
					title: t("landing.header.groups.features.platform"),
					links: [
						{ ...featureLinks.teams, icon: <UsersIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.analytics, icon: <ChartLineIcon size={20} aria-hidden="true" /> },
						{ ...featureLinks.api, icon: <KeyIcon size={20} aria-hidden="true" /> },
						{ ...mcpLink, icon: <BotIcon size={20} aria-hidden="true" /> },
					],
				},
			],
		},
		{
			label: t("landing.header.groups.solutions.label"),
			columns: [
				{ title: t("landing.header.groups.solutions.useCases"), links: useCaseLinks },
				{ title: t("landing.header.groups.solutions.audiences"), links: audienceLinks },
			],
		},
		{ label: t("landing.header.nav.compare"), href: comparison("uptimerobot") },
		{ label: t("landing.header.nav.pricing"), href: `${routes.home.href()}#pricing` },
		{ label: t("landing.header.nav.docs"), href: routes.docs.index.href() },
	];

	/**
	 * The trust page sits with the legal pages: like them, it is a standing statement about
	 * how the service is run, and a reader looking for accountability checks this corner first.
	 */
	let legalLinks: SiteFooter.Link[] = [
		{ label: label("legal.terms"), href: routes.legal.terms.href() },
		{ label: label("legal.privacy"), href: routes.legal.privacy.href() },
		{ label: t("trust.footerLink"), href: routes.trust.href() },
	];

	/**
	 * Four columns, so each keeps a label like "Login Flow Monitoring" on one line beside
	 * the brand block at laptop widths. Solutions lists the use cases, then the audiences,
	 * in the order the header's Solutions menu groups them.
	 */
	let footerColumns: SiteFooter.Column[] = [
		{ title: label("features.title"), links: Object.values(featureLinks) },
		{ title: label("solutions.title"), links: [...useCaseLinks, ...audienceLinks] },
		{
			title: label("compare.title"),
			links: [
				{ label: label("compare.uptimerobot"), href: comparison("uptimerobot") },
				{ label: label("compare.pingdom"), href: comparison("pingdom") },
				{ label: label("compare.betterUptime"), href: comparison("better-uptime") },
				{ label: label("compare.healthchecks"), href: comparison("healthchecks") },
				{ label: label("compare.cronitor"), href: comparison("cronitor") },
				{ label: label("compare.checkly"), href: comparison("checkly") },
				{ label: label("compare.statuscake"), href: comparison("statuscake") },
				{ label: label("compare.datadog"), href: comparison("datadog") },
				{ label: label("compare.site24x7"), href: comparison("site24x7") },
				{ label: label("compare.ohdear"), href: comparison("ohdear") },
			],
		},
		{
			title: label("docs.title"),
			links: [
				{ label: label("docs.overview"), href: routes.docs.index.href() },
				{ label: label("docs.quickstart"), href: "/docs/quickstart" },
				{ label: label("docs.apiReference"), href: "/docs/api/overview" },
				mcpLink,
			],
		},
	];

	return {
		brandLabel: t("landing.header.title"),
		headerItems,
		headerLabels: {
			nav: t("landing.header.menu.label"),
			open: t("landing.header.menu.open"),
			close: t("landing.header.menu.close"),
		},
		dashboardLabel: t("landing.header.nav.cta.in"),
		startLabel: t("landing.header.nav.cta.out"),
		footerColumns,
		legalLinks,
		tagline: t("landing.footer.description"),
		copyrightLine: t("landing.footer.copyright", { year: new Date().getFullYear() }),
	};
}

/**
 * Renders the sticky header and the footer around `children`. The header's call to action
 * switches on {@link MarketingLayout.Props.isSignedIn}: a one-click sign-in form when signed
 * out, which is why it rides the bar's `tools` slot and the sheet's foot rather than the
 * header's link-only `cta`. Every chrome link prefetches its page on intent.
 */
export default function MarketingLayout(handle: Handle<MarketingLayout.Props>) {
	return () => {
		let {
			isSignedIn,
			brandLabel,
			headerItems,
			headerLabels,
			dashboardLabel,
			startLabel,
			footerColumns,
			legalLinks,
			tagline,
			copyrightLine,
			children,
		} = handle.props;

		return (
			<div
				data-slot="marketing-layout"
				mix={[vstack(), minBs("100vh"), font("sans"), raw(MARKETING_TOKENS)]}
			>
				<SiteHeader
					id="site-header"
					prefetch="intent"
					collapseAt="xl"
					navLabel={headerLabels.nav}
					menuLabel={headerLabels.open}
					closeLabel={headerLabels.close}
					brand={<BrandLink label={brandLabel} />}
					items={headerItems}
					tools={
						<AuthCta
							isSignedIn={isSignedIn}
							dashboardLabel={dashboardLabel}
							startLabel={startLabel}
							size="sm"
						/>
					}
					sheet={
						<>
							<div
								data-slot="marketing-sheet-cta"
								mix={[
									marketingContainer(),
									raw({
										display: "grid",
										boxSizing: "border-box",
										inlineSize: "100%",
										paddingBlockStart: "1rem",
										paddingBlockEnd: "max(1rem, env(safe-area-inset-bottom))",
										borderBlockStart: "1px solid var(--ui-marketing-hairline)",
									}),
									when(
										"& :is(form, a, button)",
										raw({ inlineSize: "100%", justifyContent: "center" }),
									),
								]}
							>
								<AuthCta
									isSignedIn={isSignedIn}
									dashboardLabel={dashboardLabel}
									startLabel={startLabel}
								/>
							</div>
							<SheetDismiss />
						</>
					}
				/>

				<main mix={[raw({ flexGrow: "1" })]}>{children}</main>

				<SiteFooter
					prefetch="intent"
					brand={<BrandLink label={brandLabel} />}
					tagline={tagline}
					columns={footerColumns}
					legal={
						<>
							<p>{copyrightLine}</p>
							{legalLinks.map((link) => (
								<a key={link.href} href={link.href} data-rmx-prefetch="intent">
									{link.label}
								</a>
							))}
						</>
					}
				/>
			</div>
		);
	};
}

namespace BrandLink {
	export interface Props {
		label: string;
	}
}

/**
 * The home link: the brand mark in the brand ink beside the wordmark. The mark is
 * decorative, so the link's accessible name is the wordmark alone.
 */
function BrandLink(handle: Handle<BrandLink.Props>) {
	return () => (
		<a
			href={routes.home.href()}
			data-rmx-prefetch="intent"
			mix={[
				hstack({ align: "center", gap: 2 }),
				text("lg"),
				weight("bold"),
				tracking("tight"),
				fg("neutral.emphasis"),
			]}
		>
			<svg
				viewBox="0 0 1024 1024"
				width={32}
				height={32}
				fill="currentColor"
				aria-hidden="true"
				mix={[fg("brand"), is("32px"), bs("32px"), shrink(0)]}
			>
				<g transform="matrix(.1 0 0 -.1 0 1024)">
					{BRAND_MARK_PATHS.map((d) => (
						<path key={d} d={d} />
					))}
				</g>
			</svg>
			{handle.props.label}
		</a>
	);
}
