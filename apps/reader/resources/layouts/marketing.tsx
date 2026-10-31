/**
 * The header, footer and art direction every public page wears: the home, each feature,
 * each way of reading and each comparison. A visitor finds the same destinations in the
 * same places on all of them, and the editorial register is set here once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import {
	BellIcon,
	BotIcon,
	CodeIcon,
	FileArchiveIcon,
	FileTextIcon,
	FolderIcon,
	FunnelIcon,
	GraduationCapIcon,
	HeadphonesIcon,
	NewspaperIcon,
	RefreshCwIcon,
	RssIcon,
	SearchIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Button, DialogDismiss, LinkButton } from "@sdxc/ui";
import { SiteFooter, SiteHeader } from "@sdxc/ui/patterns";
import { marketingContainer } from "@sdxc/ui/styles";

import type { FeatureSlug, UseCaseSlug } from "~/config/marketing";

import { COMPARISON_SLUGS, FEATURE_KEYS, FEATURE_SLUGS, USE_CASE_SLUGS } from "~/config/marketing";
import routes from "~/routes/web";

/**
 * The editorial register: a serif display over the app's own sans body, mono uppercase
 * section labels in the emerald ink like a newspaper's slugs, small square-ish corners and
 * flat surfaces, so the page reads like the quiet thing it sells.
 */
const MARKETING_TOKENS = {
	"--ui-font-display": "var(--ui-font-serif)",
	"--ui-marketing-display-weight": "400",
	"--ui-marketing-display-tracking": "-0.02em",
	"--ui-marketing-chapter-tracking": "-0.015em",
	"--ui-marketing-chapter-leading": "1.1",
	"--ui-marketing-eyebrow-font": "var(--ui-font-mono)",
	"--ui-marketing-eyebrow-weight": "500",
	"--ui-marketing-eyebrow-transform": "uppercase",
	"--ui-marketing-eyebrow-tracking": "0.12em",
	"--ui-marketing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-marketing-cta-radius": "0.375rem",
	"--ui-button-radius": "0.375rem",
	"--ui-marketing-radius-surface": "0.5rem",
	"--ui-marketing-radius-frame": "0.625rem",
	"--ui-marketing-card-radius-outer": "0.625rem",
	"--ui-marketing-card-radius-inner": "0.375rem",
	"--ui-marketing-band-radius": "0.75rem",
	"--ui-marketing-plan-radius": "0.625rem",
	"--ui-marketing-plan-lift": "0 0 #0000",
	"--ui-shadow-float": "none",
} as const;

/** The icon each feature wears in the header's menu. */
const FEATURE_ICONS: Record<FeatureSlug, RemixNode> = {
	freshness: <RefreshCwIcon size={20} aria-hidden="true" />,
	filters: <FunnelIcon size={20} aria-hidden="true" />,
	articles: <FileTextIcon size={20} aria-hidden="true" />,
	search: <SearchIcon size={20} aria-hidden="true" />,
	notifications: <BellIcon size={20} aria-hidden="true" />,
	organize: <FolderIcon size={20} aria-hidden="true" />,
	"your-data": <FileArchiveIcon size={20} aria-hidden="true" />,
	agents: <BotIcon size={20} aria-hidden="true" />,
};

/** The icon each way of reading wears in the header's menu. */
const USE_CASE_ICONS: Record<UseCaseSlug, RemixNode> = {
	news: <NewspaperIcon size={20} aria-hidden="true" />,
	developers: <CodeIcon size={20} aria-hidden="true" />,
	research: <GraduationCapIcon size={20} aria-hidden="true" />,
	podcasts: <HeadphonesIcon size={20} aria-hidden="true" />,
};

namespace MarketingLayout {
	export interface Props {
		t: Translate;
		/** Whether the visitor is signed in, which turns the sign-in into a way back to reading. */
		isSignedIn: boolean;
		children: RemixNode;
	}
}

/**
 * Renders the sticky header and the footer around `children`. Signing in starts the
 * provider's flow from a `POST`, so the header's action rides the bar's `tools` slot and
 * the sheet's foot rather than the link-only `cta`.
 */
export default function MarketingLayout(handle: Handle<MarketingLayout.Props>) {
	return () => {
		let { children, isSignedIn, t } = handle.props;

		let featureLinks = FEATURE_SLUGS.map((slug) => ({
			label: t(`landing.nav.features.${FEATURE_KEYS[slug]}`),
			description: t(`landing.nav.descriptions.${FEATURE_KEYS[slug]}`),
			href: routes.marketing.feature.href({ slug }),
			icon: FEATURE_ICONS[slug],
		}));
		let useCaseLinks = USE_CASE_SLUGS.map((slug) => ({
			label: t(`landing.nav.useCases.${slug}`),
			description: t(`landing.nav.descriptions.${slug}`),
			href: routes.marketing.useCase.href({ slug }),
			icon: USE_CASE_ICONS[slug],
		}));
		let comparisonLinks = COMPARISON_SLUGS.map((slug) => ({
			label: t(`landing.nav.compare.${slug}`),
			href: routes.marketing.comparison.href({ slug }),
		}));

		let items: SiteHeader.Item[] = [
			{
				label: t("landing.nav.features.label"),
				columns: [
					{ title: t("landing.nav.features.reading"), links: featureLinks.slice(0, 4) },
					{ title: t("landing.nav.features.keeping"), links: featureLinks.slice(4) },
				],
			},
			{
				label: t("landing.nav.useCases.label"),
				columns: [{ title: t("landing.nav.useCases.label"), links: useCaseLinks }],
			},
			{
				label: t("landing.nav.compare.label"),
				columns: [{ title: t("landing.nav.compare.label"), links: comparisonLinks }],
			},
			{ label: t("landing.nav.plans"), href: `${routes.home.href()}#plans` },
			{ label: t("landing.nav.help"), href: routes.docs.index.href() },
		];

		let action = isSignedIn ? (
			<LinkButton href={routes.reading.index.href()} size="sm">
				{t("landing.nav.open")}
			</LinkButton>
		) : (
			<SignIn label={t("landing.nav.signIn")} size="sm" />
		);

		return (
			<div
				data-slot="marketing-layout"
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						minBlockSize: "100dvh",
						...MARKETING_TOKENS,
					}),
				]}
			>
				<SiteHeader
					id="site-header"
					prefetch="intent"
					collapseAt="lg"
					navLabel={t("landing.nav.label")}
					menuLabel={t("landing.nav.menu")}
					closeLabel={t("landing.nav.close")}
					brand={<BrandLink label={t("app.name")} />}
					items={items}
					tools={action}
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
								{isSignedIn ? (
									<LinkButton href={routes.reading.index.href()}>
										{t("landing.nav.open")}
									</LinkButton>
								) : (
									<SignIn label={t("landing.nav.signIn")} />
								)}
							</div>
							<DialogDismiss />
						</>
					}
				/>

				<main mix={[raw({ flexGrow: "1" })]}>{children}</main>

				<SiteFooter
					prefetch="intent"
					label={t("landing.footer.label")}
					brand={<BrandLink label={t("app.name")} />}
					tagline={t("landing.footer.tagline")}
					columns={[
						{ title: t("landing.nav.features.label"), links: featureLinks },
						{ title: t("landing.nav.useCases.label"), links: useCaseLinks },
						{ title: t("landing.nav.compare.label"), links: comparisonLinks },
						{ title: t("landing.nav.help"), links: helpLinks(t) },
					]}
					legal={<p>{t("landing.footer.copyright", { year: String(new Date().getFullYear()) })}</p>}
				/>
			</div>
		);
	};
}

/**
 * The footer's help column: the hub, the first two tasks, the plan reference and the door
 * to fixing a problem, which are the pages a visitor deciding whether to sign in reaches for.
 */
function helpLinks(t: Translate): SiteFooter.Link[] {
	let page = (slug: string) => routes.docs.show.href({ slug });
	return [
		{ label: t("docs.title"), href: routes.docs.index.href() },
		{ label: t("docs.footer.start"), href: page("getting-started") },
		{ label: t("docs.footer.import"), href: page("import-opml") },
		{ label: t("docs.footer.plans"), href: page("plans") },
		{ label: t("docs.footer.fix"), href: page("no-feed-found") },
	];
}

namespace SignIn {
	export interface Props {
		label: string;
		size?: "sm" | "md" | "lg";
	}
}

/**
 * The sign-in button every page repeats. It is a `POST` because starting the flow writes the
 * login transaction into the session, and a document navigation because the provider's
 * page is a different origin.
 */
export function SignIn(handle: Handle<SignIn.Props>) {
	return () => (
		<form method="post" action={routes.auth.action.href()} data-rmx-document="">
			<Button type="submit" size={handle.props.size ?? "lg"}>
				{handle.props.label}
			</Button>
		</form>
	);
}

/** The home link: the feed mark in the brand ink beside the wordmark, named by the wordmark. */
function BrandLink(handle: Handle<{ label: string }>) {
	return () => (
		<a
			href={routes.home.href()}
			data-rmx-prefetch="intent"
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					fontFamily: "var(--ui-font-serif)",
					fontSize: "1.375rem",
					color: "var(--ui-neutral-fg-emphasis)",
					textDecoration: "none",
				}),
			]}
		>
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						inlineSize: "1.75rem",
						blockSize: "1.75rem",
						borderRadius: "0.375rem",
						backgroundColor: "var(--ui-brand-bg-solid)",
						color: "var(--ui-brand-fg-on-solid)",
					}),
				]}
			>
				<RssIcon size={16} strokeWidth={2} />
			</span>
			{handle.props.label}
		</a>
	);
}
