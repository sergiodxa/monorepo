/**
 * The `/demo/bakery` landing: Hollyhock Bakery, an invented corner bakery, built from
 * `@sdxc/ui` landing patterns in a warm, homely register: terracotta and butter, a shop-sign
 * serif, gingham and scallops drawn in CSS, and every picture an SVG drawn in code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope } from "@sdxc/ui";

import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import { Hero } from "~/resources/views/demos/bakery/hero";
import { Hours } from "~/resources/views/demos/bakery/hours-band";
import { Menu } from "~/resources/views/demos/bakery/menu";
import { Closing, Neighbours, Questions } from "~/resources/views/demos/bakery/neighbours";
import { Order } from "~/resources/views/demos/bakery/order";
import { SiteFooter, SiteHeader } from "~/resources/views/demos/bakery/site-chrome";
import { Specials } from "~/resources/views/demos/bakery/specials";
import HollyhockThumbnail from "~/resources/views/demos/bakery/thumbnail";
import { GettingIn, Visit } from "~/resources/views/demos/bakery/visit";

/** Terracotta, the colour of a well-baked crust, from flour-dusted tint to burnt edge. */
const TERRACOTTA = [
	"oklch(0.982 0.012 55)",
	"oklch(0.95 0.032 52)",
	"oklch(0.9 0.062 48)",
	"oklch(0.81 0.1 45)",
	"oklch(0.71 0.135 42)",
	"oklch(0.62 0.155 40)",
	"oklch(0.54 0.15 38)",
	"oklch(0.45 0.13 36)",
	"oklch(0.36 0.1 36)",
	"oklch(0.27 0.07 38)",
	"oklch(0.19 0.045 40)",
] as const;

/** Cream by day and cocoa by night: neutrals with the warmth of butter in them. */
const CREAM_COCOA = [
	"oklch(0.975 0.018 85)",
	"oklch(0.948 0.024 82)",
	"oklch(0.9 0.028 78)",
	"oklch(0.81 0.03 72)",
	"oklch(0.71 0.03 66)",
	"oklch(0.6 0.03 60)",
	"oklch(0.5 0.028 56)",
	"oklch(0.41 0.026 52)",
	"oklch(0.32 0.024 50)",
	"oklch(0.25 0.02 50)",
	"oklch(0.18 0.016 50)",
] as const;

/** The painted shop-sign face: a soft, heavy serif where the system has one. */
const SIGN = "'Cooper Black', 'Cooper Std', 'Recoleta', 'Rockwell', Georgia, ui-serif, serif";

/** The friendly body face: rounded where the system offers it. */
const ROUNDED =
	"ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', ui-sans-serif, system-ui, sans-serif";

/**
 * A homely register: the sign serif for headings, rounded body, cookie-cutter corners on
 * calls and cards, a warm low shadow, butter where a band tints and cocoa where it inverts.
 */
const TOKENS = {
	"--ui-font-sans": ROUNDED,
	"--ui-font-display": SIGN,
	"--ui-landing-display-weight": "700",
	"--ui-landing-display-tracking": "-0.015em",
	"--ui-landing-display-max": "4.5rem",
	"--ui-landing-chapter-tracking": "-0.01em",
	"--ui-landing-cta-radius": "0.875rem",
	"--ui-landing-cta-height": "3rem",
	"--ui-landing-cta-weight": "700",
	"--ui-button-radius": "0.875rem",
	"--ui-landing-eyebrow-font": ROUNDED,
	"--ui-landing-eyebrow-transform": "none",
	"--ui-landing-eyebrow-tracking": "0",
	"--ui-landing-eyebrow-weight": "700",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-landing-radius-surface": "1.25rem",
	"--ui-landing-card-radius-outer": "1.5rem",
	"--ui-landing-card-radius-inner": "1rem",
	"--ui-landing-radius-frame": "1.5rem",
	"--ui-landing-band-radius": "2rem",
	"--ui-landing-band-glow": "none",
	"--ui-neutral-bg-solid": "var(--ui-color-neutral-900)",
} as const;

/** The whole page, so the instant it was asked for reaches every band that reads the clock. */
function HollyhockPage(handle: Handle<{ now: Date }>) {
	return () => {
		let { now } = handle.props;
		return (
			<DemoTheme brand={TERRACOTTA} neutral={CREAM_COCOA} tokens={TOKENS}>
				<SiteHeader />
				<main mix={[when("& [id]", raw({ scrollMarginBlockStart: "5.5rem" }))]}>
					<HeadingScope>
						<Hero now={now} />
						<Specials now={now} />
						<Menu />
						<Hours now={now} />
						<Order now={now} />
						<Visit />
						<GettingIn />
						<Neighbours />
						<Questions />
						<Closing />
					</HeadingScope>
				</main>
				<SiteFooter />
			</DemoTheme>
		);
	};
}

/** What `/demo/bakery` serves: Hollyhock's head metadata and its whole page. */
export default {
	title: "Hollyhock Bakery — warm bread on Alder Street",
	kind: "Local business landing",
	tagline: "A neighbourhood bakery with hours that know the time.",
	artDirection: "Terracotta and butter, gingham and scallops, drawn by hand in code.",
	description:
		"Hollyhock Bakery on Alder Street: today's bake, the menu and prices, opening hours that know the time, pickup orders, directions, step-free access and parking.",
	thumbnail: () => (
		<DemoMiniature brand={TERRACOTTA} neutral={CREAM_COCOA} tokens={TOKENS}>
			<HollyhockThumbnail />
		</DemoMiniature>
	),
	render: () => <HollyhockPage now={new Date()} />,
} satisfies DemoLanding;
