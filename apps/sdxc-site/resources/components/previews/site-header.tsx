/**
 * Live preview for `SiteHeader`: a product bar with a three-column Product panel, two plain
 * links, a log-in action and the primary call to action. On a phone frame the links fold
 * into the full-screen sheet behind the menu button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SiteHeader as SiteHeaderType } from "@sdxc/ui/patterns";

import {
	BellRingIcon,
	CalendarClockIcon,
	GaugeIcon,
	GlobeIcon,
	NewspaperIcon,
	UsersIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { text, tracking, weight } from "@sdxc/u/typography";
import { SiteHeader } from "@sdxc/ui/patterns";

/** The Product group: three titled columns and a closing link, the shape a mega panel suits. */
const PRODUCT: SiteHeaderType.Group = {
	label: "Product",
	columns: [
		{
			title: "Monitor",
			links: [
				{
					label: "Uptime",
					href: "#uptime",
					description: "Probes from 12 regions",
					icon: <GaugeIcon />,
				},
				{
					label: "Cron jobs",
					href: "#cron",
					description: "Heartbeats for every schedule",
					icon: <CalendarClockIcon />,
				},
			],
		},
		{
			title: "Respond",
			links: [
				{
					label: "On-call",
					href: "#on-call",
					description: "Rotas that page the right person",
					icon: <BellRingIcon />,
				},
				{
					label: "Teams",
					href: "#teams",
					description: "Roles, escalation and handover",
					icon: <UsersIcon />,
				},
			],
		},
		{
			title: "Share",
			links: [
				{
					label: "Status pages",
					href: "#status",
					description: "On your own domain",
					icon: <GlobeIcon />,
				},
				{
					label: "Changelog",
					href: "#changelog",
					description: "What shipped this month",
					icon: <NewspaperIcon />,
				},
			],
		},
	],
	footer: { label: "Browse every feature", href: "#features" },
};

/** The source the page shows, matching the markup below. */
const CODE = `<SiteHeader
	brand={
		<a href="/" aria-label="Beacon home">
			<BeaconLogo />
		</a>
	}
	items={[
		{
			label: "Product",
			columns: [
				{
					title: "Monitor",
					links: [
						{ label: "Uptime", href: "/uptime", description: "Probes from 12 regions", icon: <GaugeIcon /> },
						…
					],
				},
				…
			],
			footer: { label: "Browse every feature", href: "/features" },
		},
		{ label: "Pricing", href: "/pricing" },
		{ label: "Docs", href: "/docs" },
	]}
	actions={[{ label: "Log in", href: "/login" }]}
	cta={{ label: "Start free", href: "/signup" }}
/>`;

/**
 * A two-part wordmark: a ring glyph in the brand color beside the name in the heading ink,
 * sized to sit on the bar's center line.
 */
export function BeaconLogo() {
	return () => (
		<span mix={[hstack({ gap: 2, align: "center" })]}>
			<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
				<circle cx="11" cy="11" r="9" stroke="var(--ui-brand-fg)" stroke-width="2.5" />
				<circle cx="11" cy="11" r="3.5" fill="var(--ui-brand-fg)" />
			</svg>
			<span mix={[text("lg"), weight("semibold"), tracking("tight")]}>Beacon</span>
		</span>
	);
}

/** What the preview registry reads: the source to show, and the header to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<SiteHeader
			brand={
				<a href="#top" aria-label="Beacon home" mix={[fg("neutral.emphasis")]}>
					<BeaconLogo />
				</a>
			}
			items={[
				PRODUCT,
				{ label: "Customers", href: "#customers" },
				{ label: "Pricing", href: "#pricing" },
				{ label: "Docs", href: "#docs" },
			]}
			actions={[{ label: "Log in", href: "#login" }]}
			cta={{ label: "Start free", href: "#signup" }}
		/>
	),
};
