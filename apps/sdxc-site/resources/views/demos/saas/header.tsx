/**
 * Keel's sticky bar: the logo, four in-page destinations and the two account actions.
 * Below the `lg` container the destinations and sign-in move into a native popover the
 * menu button toggles, so the phone menu opens and dismisses with no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MenuIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { backdropBlur } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, hidden, hstack, insBs, sticky, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Button, LinkButton, Popover } from "@sdxc/ui";
import { marketingContainer, marketingCtaChrome } from "@sdxc/ui/styles";

import { KeelLogo } from "~/resources/views/demos/saas/marks";
import { showFrom } from "~/resources/views/demos/saas/visibility";

/** The in-page destinations, as label and anchor, in reading order. */
export const NAV_LINKS = [
	["Product", "#product"],
	["Workflow", "#workflow"],
	["Customers", "#customers"],
	["Pricing", "#pricing"],
	["FAQ", "#faq"],
] as const;

/** The popover's id, which the menu button's `commandfor` names. */
const MENU_ID = "keel-menu";

/** The named container the bar's breakpoints read, sized by the bar itself. */
const BAR = "keel-bar";

/**
 * Renders the bar. It sits on a blurred, 80% page fill with a hairline under it, so
 * the bands scroll visibly beneath it and the bar never reads as a band of its own.
 *
 * @returns The render function producing the header.
 */
export function SaasHeader() {
	return () => (
		<header
			mix={[
				sticky(),
				insBs(0),
				z(20),
				is("100%"),
				container(BAR),
				backdropBlur("md"),
				raw({
					backgroundColor: "color-mix(in oklch, var(--ui-bg) 82%, transparent)",
					borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
				}),
			]}
		>
			<div
				mix={[
					marketingContainer(),
					hstack({ gap: 6, align: "center", justify: "between" }),
					bs("4rem"),
				]}
			>
				<a href="#top" aria-label="Keel home" mix={[fg("neutral.emphasis")]}>
					<KeelLogo />
				</a>

				<nav
					aria-label="Main"
					mix={[
						showFrom("lg", BAR, "flex"),
						raw({ alignItems: "center", gap: "1.75rem" }),
						text("sm"),
					]}
				>
					{NAV_LINKS.map(([label, href]) => (
						<a
							key={href}
							href={href}
							mix={[weight("medium"), fg("neutral"), hover(fg("neutral.emphasis"))]}
						>
							{label}
						</a>
					))}
				</nav>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<span mix={[showFrom("lg", BAR, "inline-flex")]}>
						<LinkButton href="#pricing" variant="ghost" color="neutral" size="sm">
							Sign in
						</LinkButton>
					</span>
					<LinkButton href="#start" color="brand" size="sm" mix={[marketingCtaChrome()]}>
						Start free
					</LinkButton>
					<span mix={[at("lg", BAR, hidden())]}>
						<Button
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={MENU_ID}
							command="toggle-popover"
							aria-label="Open menu"
						>
							<MenuIcon data-slot="icon" aria-hidden="true" />
						</Button>
					</span>
				</div>
			</div>

			<Popover
				id={MENU_ID}
				placement="bottom-end"
				aria-label="Menu"
				mix={[is("min(18rem, 100vw - 2rem)"), p(2)]}
			>
				<nav aria-label="Main" mix={[vstack({ gap: 0, align: "stretch" })]}>
					{NAV_LINKS.map(([label, href]) => (
						<a
							key={href}
							href={href}
							mix={[
								p(2.5, 3),
								text("base"),
								weight("medium"),
								fg("neutral.emphasis"),
								raw({ borderRadius: "0.5rem" }),
								hover(bg("neutral.tint-hover")),
							]}
						>
							{label}
						</a>
					))}
					<a
						href="#pricing"
						mix={[
							p(2.5, 3),
							text("base"),
							fg("neutral"),
							raw({
								borderBlockStart: "1px solid var(--ui-marketing-hairline)",
								marginBlockStart: "0.25rem",
							}),
						]}
					>
						Sign in
					</a>
				</nav>
			</Popover>
		</header>
	);
}
