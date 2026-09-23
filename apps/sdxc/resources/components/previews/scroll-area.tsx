/**
 * Live preview island for `ScrollArea`. The frame only scrolls once its content
 * outgrows it, so the example carries a whole deploy log rather than a line of text,
 * and the two scroll-timeline factories a reader pairs with it: `scrollShadow()`
 * under the sticky header, and `scrollFade()` tapering the viewport's own edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { hstack, sticky, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, ScrollArea, Separator, Text } from "@sdxc/ui";
import { scrollFade, scrollShadow } from "@sdxc/ui/animations";
import { clientEntry, css } from "remix/ui";

/** One row of the log the viewport scrolls, so the example reads as a real deploy history. */
interface Deploy {
	sha: string;
	summary: string;
	environment: string;
	status: "success" | "warning" | "danger";
	at: string;
}

/** Enough history that the frame has to scroll, which is what the component is for. */
const DEPLOYS: Deploy[] = [
	{
		sha: "d9fc7d9",
		summary: "Second-factor backoff",
		environment: "production",
		status: "success",
		at: "12:41",
	},
	{
		sha: "26cb3ca",
		summary: "Per-subject password backoff",
		environment: "production",
		status: "success",
		at: "11:58",
	},
	{
		sha: "e37b40e",
		summary: "Management API reference",
		environment: "staging",
		status: "success",
		at: "11:12",
	},
	{
		sha: "8950280",
		summary: "Tenants and domains routes",
		environment: "staging",
		status: "warning",
		at: "10:47",
	},
	{
		sha: "c5959d3",
		summary: "Audit events route",
		environment: "staging",
		status: "success",
		at: "10:02",
	},
	{
		sha: "a1b7f04",
		summary: "Session cookie rotation",
		environment: "production",
		status: "danger",
		at: "09:35",
	},
	{
		sha: "7c2de91",
		summary: "Rate limit headers",
		environment: "preview",
		status: "success",
		at: "09:04",
	},
	{
		sha: "4fe0a3b",
		summary: "Drop the legacy token table",
		environment: "preview",
		status: "success",
		at: "08:48",
	},
	{
		sha: "b03cc17",
		summary: "Sign-in throttle metrics",
		environment: "preview",
		status: "warning",
		at: "08:21",
	},
	{
		sha: "f61d5aa",
		summary: "Passkey enrollment copy",
		environment: "preview",
		status: "success",
		at: "07:56",
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SCROLL_AREA_CODE = `<ScrollArea aria-label="Deploy history">
	<ScrollArea.Viewport mix={[scrollFade({ size: "2rem" })]}>
		<header
			mix={[
				sticky(),
				scrollShadow({ distance: "48px" }),
				css({ insetBlockStart: "0", zIndex: "1" }),
				hstack({ gap: 2, align: "center", justify: "between" }),
				p(3),
				bg(),
			]}
		>
			Deploy history
			<Text>{deploys.length} deploys today</Text>
		</header>

		{deploys.map((deploy) => (
			<div key={deploy.sha}>
				<div mix={[hstack({ gap: 3, align: "center" }), p(3)]}>
					<code>{deploy.sha}</code>
					<span mix={[css({ flexGrow: "1" })]}>{deploy.summary}</span>
					<Badge color={deploy.status} variant="secondary">
						{deploy.environment}
					</Badge>
					<Text>{deploy.at}</Text>
				</div>
				<Separator />
			</div>
		))}
	</ScrollArea.Viewport>
</ScrollArea>`;

/** A deploy log tall enough to scroll, hydrated so both scroll timelines run. */
export const ScrollAreaPreview = clientEntry(
	"/resources/components/previews/scroll-area.tsx#ScrollAreaPreview",
	function ScrollAreaPreview() {
		return () => (
			<ScrollArea aria-label="Deploy history" mix={[is("26rem"), bs("13rem")]}>
				<ScrollArea.Viewport mix={[scrollFade({ size: "2rem" })]}>
					<header
						mix={[
							sticky(),
							scrollShadow({ distance: "48px" }),
							css({ insetBlockStart: "0", zIndex: "1" }),
							hstack({ gap: 2, align: "center", justify: "between" }),
							p(3),
							bg(),
							text("sm"),
							weight("medium"),
						]}
					>
						Deploy history
						<Text>{DEPLOYS.length} deploys today</Text>
					</header>

					<div mix={[vstack({ gap: 0, align: "stretch" })]}>
						{DEPLOYS.map((deploy) => (
							<div key={deploy.sha}>
								<div mix={[hstack({ gap: 3, align: "center" }), p(3)]}>
									<code mix={[text("xs"), fg("neutral"), css({ inlineSize: "4.5rem" })]}>
										{deploy.sha}
									</code>
									<span mix={[text("sm"), css({ flexGrow: "1" })]}>{deploy.summary}</span>
									<Badge color={deploy.status} variant="secondary">
										{deploy.environment}
									</Badge>
									<Text mix={[text("xs")]}>{deploy.at}</Text>
								</div>
								<Separator />
							</div>
						))}
					</div>
				</ScrollArea.Viewport>
			</ScrollArea>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SCROLL_AREA_CODE, render: () => <ScrollAreaPreview /> };
