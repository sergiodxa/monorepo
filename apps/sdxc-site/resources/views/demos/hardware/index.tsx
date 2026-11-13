/**
 * The `/demo/hardware` landing: the launch page for Strata Two, an invented aluminium
 * keyboard, set on a dark product stage with aluminium neutrals, one signal-orange key and
 * precise light, the board drawn in SVG and taken apart by scroll-driven CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import InTheBox from "~/resources/views/demos/hardware/box";
import { StrataFooter, StrataHeader } from "~/resources/views/demos/hardware/chrome";
import Compare from "~/resources/views/demos/hardware/compare";
import ExplodedScene from "~/resources/views/demos/hardware/exploded";
import Faq from "~/resources/views/demos/hardware/faq";
import { finishColours } from "~/resources/views/demos/hardware/finish";
import Finishes from "~/resources/views/demos/hardware/finishes";
import Hero from "~/resources/views/demos/hardware/hero";
import InUseScene from "~/resources/views/demos/hardware/in-use";
import MaterialsScene from "~/resources/views/demos/hardware/materials";
import { readOrder } from "~/resources/views/demos/hardware/order";
import PlayBand from "~/resources/views/demos/hardware/play";
import Preorder from "~/resources/views/demos/hardware/preorder";
import Reviews from "~/resources/views/demos/hardware/reviews";
import Specs from "~/resources/views/demos/hardware/specs";
import StrataThumbnail from "~/resources/views/demos/hardware/thumbnail";

/** Signal orange, the colour of the escape key and the only colour on the page that is not metal. */
const SIGNAL = [
	"oklch(0.98 0.012 48)",
	"oklch(0.95 0.032 48)",
	"oklch(0.9 0.07 48)",
	"oklch(0.82 0.12 48)",
	"oklch(0.74 0.16 46)",
	"oklch(0.66 0.18 44)",
	"oklch(0.57 0.17 42)",
	"oklch(0.47 0.145 40)",
	"oklch(0.37 0.11 40)",
	"oklch(0.27 0.075 40)",
	"oklch(0.18 0.045 40)",
] as const;

/** Aluminium: cool greys with a trace of blue, darkest at the stage floor. */
const ALUMINIUM = [
	"oklch(0.985 0.002 250)",
	"oklch(0.955 0.004 250)",
	"oklch(0.9 0.006 250)",
	"oklch(0.82 0.008 250)",
	"oklch(0.71 0.01 250)",
	"oklch(0.6 0.011 250)",
	"oklch(0.5 0.011 250)",
	"oklch(0.4 0.01 250)",
	"oklch(0.29 0.008 250)",
	"oklch(0.2 0.006 250)",
	"oklch(0.13 0.004 250)",
] as const;

/** The system's display grotesk: SF on Apple devices, Segoe or Roboto elsewhere. */
const SANS =
	"-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

/**
 * Product-page register: a large, tightly tracked grotesk, pill calls, 14px machined
 * corners, hairlines instead of borders, and small tracked uppercase eyebrows in the
 * aluminium grey, so the board is the only thing on the page with colour.
 */
const TOKENS = {
	"--ui-font-sans": SANS,
	"--ui-font-display": SANS,
	"--ui-landing-display-weight": "600",
	"--ui-landing-display-tracking": "-0.04em",
	"--ui-landing-display-max": "5rem",
	"--ui-landing-chapter-tracking": "-0.035em",
	"--ui-landing-cta-radius": "9999px",
	"--ui-button-radius": "9999px",
	"--ui-landing-cta-weight": "550",
	"--ui-landing-radius-surface": "14px",
	"--ui-landing-card-radius-outer": "14px",
	"--ui-landing-card-radius-inner": "8px",
	"--ui-landing-radius-frame": "14px",
	"--ui-landing-band-radius": "20px",
	"--ui-landing-eyebrow-font": SANS,
	"--ui-landing-eyebrow-weight": "600",
	"--ui-landing-eyebrow-transform": "uppercase",
	"--ui-landing-eyebrow-tracking": "0.14em",
	"--ui-landing-eyebrow-color": "var(--ui-neutral-fg-muted)",
	"--ui-landing-band-glow": "none",
	"--ui-shadow-float": "0 0 0 1px var(--ui-landing-hairline), 0 24px 48px -24px rgb(0 0 0 / 0.45)",
} as const;

/** What `/demo/hardware` serves: Strata Two's head metadata and its whole page. */
export default {
	title: "Strata Two — a keyboard milled from one block of aluminium",
	kind: "Hardware launch",
	tagline: "A 75% aluminium keyboard, on preorder.",
	artDirection: "Dark stage, aluminium and raking light.",
	description:
		"Strata Two is a 75% keyboard in a one-piece aluminium case with a gasket-mounted plate. Preorder batch 03 for $279, shipping 9 March 2027.",
	thumbnail: () => (
		<DemoMiniature brand={SIGNAL} neutral={ALUMINIUM} tokens={TOKENS}>
			<StrataThumbnail />
		</DemoMiniature>
	),
	render: (url?: URL) => {
		let order = readOrder(url);
		return (
			<DemoTheme brand={SIGNAL} neutral={ALUMINIUM} tokens={TOKENS}>
				<div
					data-slot="strata-page"
					mix={[
						finishColours(),
						raw({ display: "flex", flexDirection: "column", flex: "1" }),
						when("& main [id]", raw({ scrollMarginBlockStart: "4.5rem" })),
					]}
				>
					<StrataHeader />
					<main>
						<Hero />
						<ExplodedScene />
						<MaterialsScene />
						<InUseScene />
						<PlayBand />
						<Finishes selected={order.finish} />
						<Specs />
						<InTheBox />
						<Compare />
						<Reviews />
						<Preorder order={order} />
						<Faq />
					</main>
					<StrataFooter />
				</div>
			</DemoTheme>
		);
	},
} satisfies DemoLanding;
