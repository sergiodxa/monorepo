/**
 * One square product ad for the documentation right rail: a single outbound link
 * painted as a 1:1 tile so the pitch stays a fixed size under the table of contents.
 * Each surface carries a light and a dark palette so the tile follows the document
 * theme the same way the rest of the site does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { iife } from "@sdxc/iife";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { aspect, is, m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, nowrap, text, tracking, weight } from "@sdxc/u/typography";

import type { SidebarAdDefinition, SidebarAdSurface } from "~/resources/content/ads";

import { sidebarAdHref } from "~/app/services/ads";

namespace SidebarAd {
	export interface Props {
		ad: SidebarAdDefinition;
	}
}

/** One painted scheme: fill, copy, accent, and the hairline around the tile. */
interface AdPalette {
	background: string;
	ink: string;
	muted: string;
	accent: string;
	border: string;
}

/** Light and dark paints for every catalogue surface. */
interface AdSurfaceSchemes {
	light: AdPalette;
	dark: AdPalette;
}

/**
 * Palettes per surface. Light paints are the default on the tile; dark overrides
 * under `.dark` and under `.system` when the reader prefers dark.
 */
const SURFACES: Record<SidebarAdSurface, AdSurfaceSchemes> = {
	"uptime-forest": {
		light: {
			background: "linear-gradient(165deg, #e8f7ef 0%, #f3fbf6 45%, #f7fcf9 100%)",
			ink: "#0b3d2c",
			muted: "rgba(11, 61, 44, 0.68)",
			accent: "#047857",
			border: "rgba(4, 120, 87, 0.18)",
		},
		dark: {
			background: "linear-gradient(165deg, #10241c 0%, #0b1512 45%, #07100e 100%)",
			ink: "#ecfdf5",
			muted: "rgba(215, 245, 230, 0.75)",
			accent: "#6ee7b7",
			border: "transparent",
		},
	},
	"uptime-steel": {
		light: {
			background: "radial-gradient(90% 80% at 80% 0%, #e4f3fb 0%, #f2f8fc 55%, #f7fafc 100%)",
			ink: "#0c4a6e",
			muted: "rgba(12, 74, 110, 0.68)",
			accent: "#0e7490",
			border: "rgba(14, 116, 144, 0.18)",
		},
		dark: {
			background: "radial-gradient(90% 80% at 80% 0%, #123047 0%, #0a1622 55%, #070e16 100%)",
			ink: "#e6f7ff",
			muted: "rgba(230, 247, 255, 0.72)",
			accent: "#67e8f9",
			border: "transparent",
		},
	},
	"uptime-ink": {
		light: {
			background: "#f4f4f5",
			ink: "#18181b",
			muted: "rgba(24, 24, 27, 0.62)",
			accent: "#b45309",
			border: "rgba(24, 24, 27, 0.1)",
		},
		dark: {
			background: "#121212",
			ink: "#f5f5f4",
			muted: "rgba(245, 245, 244, 0.65)",
			accent: "#fbbf24",
			border: "rgba(255,255,255,0.08)",
		},
	},
	"uptime-amber": {
		light: {
			background: "#fff8eb",
			ink: "#78350f",
			muted: "rgba(120, 53, 15, 0.68)",
			accent: "#b45309",
			border: "rgba(180, 83, 9, 0.16)",
		},
		dark: {
			background: "#14110c",
			ink: "#fff4e5",
			muted: "rgba(255, 244, 229, 0.7)",
			accent: "#fbbf24",
			border: "transparent",
		},
	},
	"uptime-violet": {
		light: {
			background: "#f5f3ff",
			ink: "#4c1d95",
			muted: "rgba(76, 29, 149, 0.68)",
			accent: "#6d28d9",
			border: "rgba(109, 40, 217, 0.16)",
		},
		dark: {
			background: "#120f18",
			ink: "#f3eefe",
			muted: "rgba(243, 238, 254, 0.7)",
			accent: "#c4b5fd",
			border: "transparent",
		},
	},
	"uptime-lime": {
		light: {
			background: "#f5f9e8",
			ink: "#365314",
			muted: "rgba(54, 83, 20, 0.68)",
			accent: "#4d7c0f",
			border: "rgba(77, 124, 15, 0.16)",
		},
		dark: {
			background: "#10140c",
			ink: "#eef6e4",
			muted: "rgba(238, 246, 228, 0.7)",
			accent: "#a3e635",
			border: "transparent",
		},
	},
	"handbook-navy": {
		light: {
			background: "linear-gradient(160deg, #eef3fb 0%, #f5f8fc 50%, #f8fafc 100%)",
			ink: "#1e3a5f",
			muted: "rgba(30, 58, 95, 0.68)",
			accent: "#1d4ed8",
			border: "rgba(29, 78, 216, 0.16)",
		},
		dark: {
			background: "linear-gradient(160deg, #152238 0%, #0d1728 50%, #0a1220 100%)",
			ink: "#eef3fb",
			muted: "rgba(238, 243, 251, 0.72)",
			accent: "#93c5fd",
			border: "rgba(255,255,255,0.08)",
		},
	},
	"handbook-charcoal": {
		light: {
			background: "#f1f5f9",
			ink: "#0f172a",
			muted: "rgba(15, 23, 42, 0.62)",
			accent: "#2563eb",
			border: "rgba(15, 23, 42, 0.1)",
		},
		dark: {
			background: "#14181f",
			ink: "#f1f5f9",
			muted: "rgba(241, 245, 249, 0.65)",
			accent: "#60a5fa",
			border: "transparent",
		},
	},
	"handbook-code": {
		light: {
			background: "linear-gradient(180deg, #f0f6fb 0%, #f5f9fc 100%)",
			ink: "#0f172a",
			muted: "rgba(15, 23, 42, 0.62)",
			accent: "#0369a1",
			border: "rgba(3, 105, 161, 0.14)",
		},
		dark: {
			background: "linear-gradient(180deg, #0f1419 0%, #101820 100%)",
			ink: "#f8fafc",
			muted: "rgba(226, 232, 240, 0.65)",
			accent: "#7dd3fc",
			border: "transparent",
		},
	},
	"handbook-forest": {
		light: {
			background: "radial-gradient(100% 90% at 0% 100%, #e7f3ec 0%, #f3f9f5 55%, #f7fbf8 100%)",
			ink: "#14532d",
			muted: "rgba(20, 83, 45, 0.68)",
			accent: "#15803d",
			border: "rgba(21, 128, 61, 0.16)",
		},
		dark: {
			background: "radial-gradient(100% 90% at 0% 100%, #1a2e24 0%, #101a16 55%, #0c1210 100%)",
			ink: "#ecf4ef",
			muted: "rgba(236, 244, 239, 0.75)",
			accent: "#d8f3e3",
			border: "transparent",
		},
	},
};

/** Renders one square ad as a single outbound link. */
export default function SidebarAd(handle: Handle<SidebarAd.Props>) {
	return () => {
		let { ad } = handle.props;
		let schemes = SURFACES[ad.surface];
		let titleFace = iife(() => {
			if (ad.titleFace === "serif") return font("serif");
			if (ad.titleFace === "mono") return font("mono");
			return null;
		});

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
						"--ad-bg": schemes.light.background,
						"--ad-ink": schemes.light.ink,
						"--ad-muted": schemes.light.muted,
						"--ad-accent": schemes.light.accent,
						"--ad-border": schemes.light.border,
						background: "var(--ad-bg)",
						color: "var(--ad-ink)",
						textDecoration: "none",
						border: "1px solid var(--ad-border)",
					}),
					dark(
						raw({
							"--ad-bg": schemes.dark.background,
							"--ad-ink": schemes.dark.ink,
							"--ad-muted": schemes.dark.muted,
							"--ad-accent": schemes.dark.accent,
							"--ad-border": schemes.dark.border,
						}),
					),
					when("&:hover", raw({ filter: "brightness(0.97)" })),
					dark(when("&:hover", raw({ filter: "brightness(1.06)" }))),
					when("&:focus-visible", raw({ outline: "2px solid var(--ad-accent)", outlineOffset: 2 })),
				]}
			>
				<span
					mix={[
						m(0),
						text("xs"),
						weight("bold"),
						tracking("wider"),
						raw({
							color: "var(--ad-muted)",
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
							raw({ color: "var(--ad-ink)" }),
						]}
					>
						{ad.title}
					</span>
					<span mix={[m(0), text("sm"), leading("snug"), raw({ color: "var(--ad-muted)" })]}>
						{ad.tagline}
					</span>
				</span>

				<span
					mix={[m(0), text("sm"), weight("semibold"), nowrap(), raw({ color: "var(--ad-accent)" })]}
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
