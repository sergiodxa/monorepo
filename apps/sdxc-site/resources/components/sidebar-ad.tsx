/**
 * One square product ad for the documentation right rail: a single outbound link
 * painted as a 1:1 tile so the pitch stays a fixed size under the table of contents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { rounded } from "sdxc/u/effects";
import { raw } from "sdxc/u/general";
import { vstack } from "sdxc/u/layout";
import { aspect, is, m, p } from "sdxc/u/size";
import { when } from "sdxc/u/state";
import { font, leading, nowrap, text, tracking, weight } from "sdxc/u/typography";

import type { SidebarAdDefinition, SidebarAdSurface } from "~/resources/content/ads";

import { sidebarAdHref } from "~/app/services/ads";

namespace SidebarAd {
	export interface Props {
		ad: SidebarAdDefinition;
	}
}

/** Palette each surface paints: background, muted copy, and the accent CTA. */
const SURFACES: Record<
	SidebarAdSurface,
	{ background: string; ink: string; muted: string; accent: string }
> = {
	"uptime-forest": {
		background: "linear-gradient(165deg, #10241c 0%, #0b1512 45%, #07100e 100%)",
		ink: "#ecfdf5",
		muted: "rgba(215, 245, 230, 0.75)",
		accent: "#6ee7b7",
	},
	"uptime-steel": {
		background: "radial-gradient(90% 80% at 80% 0%, #123047 0%, #0a1622 55%, #070e16 100%)",
		ink: "#e6f7ff",
		muted: "rgba(230, 247, 255, 0.72)",
		accent: "#67e8f9",
	},
	"uptime-ink": {
		background: "#121212",
		ink: "#f5f5f4",
		muted: "rgba(245, 245, 244, 0.65)",
		accent: "#fbbf24",
	},
	"uptime-amber": {
		background: "#14110c",
		ink: "#fff4e5",
		muted: "rgba(255, 244, 229, 0.7)",
		accent: "#fbbf24",
	},
	"uptime-violet": {
		background: "#120f18",
		ink: "#f3eefe",
		muted: "rgba(243, 238, 254, 0.7)",
		accent: "#c4b5fd",
	},
	"uptime-lime": {
		background: "#10140c",
		ink: "#eef6e4",
		muted: "rgba(238, 246, 228, 0.7)",
		accent: "#a3e635",
	},
	"handbook-navy": {
		background: "linear-gradient(160deg, #152238 0%, #0d1728 50%, #0a1220 100%)",
		ink: "#eef3fb",
		muted: "rgba(238, 243, 251, 0.72)",
		accent: "#93c5fd",
	},
	"handbook-charcoal": {
		background: "#14181f",
		ink: "#f1f5f9",
		muted: "rgba(241, 245, 249, 0.65)",
		accent: "#60a5fa",
	},
	"handbook-code": {
		background: "linear-gradient(180deg, #0f1419 0%, #101820 100%)",
		ink: "#f8fafc",
		muted: "rgba(226, 232, 240, 0.65)",
		accent: "#7dd3fc",
	},
	"handbook-forest": {
		background: "radial-gradient(100% 90% at 0% 100%, #1a2e24 0%, #101a16 55%, #0c1210 100%)",
		ink: "#ecf4ef",
		muted: "rgba(236, 244, 239, 0.75)",
		accent: "#d8f3e3",
	},
};

/** Renders one square ad as a single outbound link. */
export default function SidebarAd(handle: Handle<SidebarAd.Props>) {
	return () => {
		let { ad } = handle.props;
		let surface = SURFACES[ad.surface];
		let titleFace =
			ad.titleFace === "serif" ? font("serif") : ad.titleFace === "mono" ? font("mono") : null;

		return (
			<a
				href={sidebarAdHref(ad)}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`${ad.title}. ${ad.tagline}`}
				mix={[
					aspect("square"),
					is("100%"),
					rounded("xl"),
					p(5),
					vstack({ gap: 3, justify: "between", align: "stretch" }),
					raw({
						background: surface.background,
						color: surface.ink,
						textDecoration: "none",
						border:
							ad.surface === "uptime-ink" || ad.surface === "handbook-navy"
								? "1px solid rgba(255,255,255,0.08)"
								: "1px solid transparent",
					}),
					when("&:hover", raw({ filter: "brightness(1.06)" })),
					when(
						"&:focus-visible",
						raw({ outline: `2px solid ${surface.accent}`, outlineOffset: 2 }),
					),
				]}
			>
				<span
					mix={[
						m(0),
						text("xs"),
						weight("bold"),
						tracking("wider"),
						raw({
							color: surface.muted,
							textTransform: "uppercase",
							letterSpacing: "0.12em",
						}),
					]}
				>
					{ad.kicker}
				</span>

				<span mix={[vstack({ gap: 2, align: "stretch" }), growBody()]}>
					<span
						mix={[
							m(0),
							text(ad.title.length > 28 ? "lg" : "xl"),
							weight("bold"),
							leading("tight"),
							tracking("tight"),
							titleFace,
							raw({ color: surface.ink }),
						]}
					>
						{ad.title}
					</span>
					<span mix={[m(0), text("sm"), leading("snug"), raw({ color: surface.muted })]}>
						{ad.tagline}
					</span>
				</span>

				<span
					mix={[m(0), text("sm"), weight("semibold"), nowrap(), raw({ color: surface.accent })]}
				>
					{ad.cta}
				</span>
			</a>
		);
	};
}

/**
 * Lets the title block claim the free space between kicker and footer so short
 * pitches still sit with the same vertical rhythm as longer ones.
 */
function growBody() {
	return raw({ flex: "1 1 auto", justifyContent: "center" });
}
