/**
 * The about-the-author band: who Odile Varga is and why a reader should trust her on type,
 * beside a portrait card with her byline. The portrait is a drawn illustration, so the page
 * names an invented author without borrowing a real person's face.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Avatar } from "@sdxc/ui";
import { FeatureBand } from "@sdxc/ui/patterns";
import { marketingSurface } from "@sdxc/ui/styles";

/**
 * Renders the bio and credentials beside the portrait card from the `lg` container up,
 * and above it on a phone.
 *
 * @returns The render function producing the band.
 */
export default function BookAuthor() {
	return () => (
		<FeatureBand
			id="author"
			layout="split"
			tone="tinted"
			eyebrow="About the author"
			title="Written by a type designer who ships code"
			description={
				<>
					Odile Varga has drawn typefaces for fifteen years and built design systems for ten. She
					wrote The Measure for the people she kept explaining it to:{" "}
					<strong>the engineers who set the type</strong> that designers only drew.
				</>
			}
			media={
				<figure
					mix={[
						m(0),
						marketingSurface(),
						p(6),
						vstack({ gap: 5, align: "stretch" }),
						raw({ maxInlineSize: "26rem", marginInline: "auto" }),
					]}
				>
					<svg
						viewBox="0 0 400 300"
						role="img"
						aria-label="An illustrated portrait of Odile Varga at her drafting table"
						mix={[
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "auto",
								borderRadius: "0.75rem",
							}),
						]}
					>
						<rect width="400" height="300" fill="var(--ui-brand-bg-tint)" />
						<circle cx="300" cy="70" r="120" fill="var(--ui-brand-border)" opacity="0.5" />
						<rect
							x="0"
							y="232"
							width="400"
							height="68"
							fill="var(--ui-brand-bg-solid)"
							opacity="0.18"
						/>
						<path d="M120 300c6-62 44-96 80-96s74 34 80 96Z" fill="var(--ui-brand-bg-solid)" />
						<rect x="186" y="170" width="28" height="34" rx="10" fill="#d9a588" />
						<ellipse cx="200" cy="140" rx="40" ry="46" fill="#e5b597" />
						<path
							d="M158 140c-6-44 18-70 46-70 30 0 50 24 42 66-6-20-20-34-40-36-18 6-34 18-48 40Z"
							fill="#3b2318"
						/>
						<g fill="none" stroke="#3b2318" stroke-width="3">
							<circle cx="184" cy="146" r="11" />
							<circle cx="218" cy="146" r="11" />
							<path d="M195 146h12" />
						</g>
						<path d="M190 168q10 6 20 0" stroke="#7a3b25" stroke-width="2.5" fill="none" />
						<text
							x="310"
							y="250"
							text-anchor="middle"
							fill="var(--ui-neutral-fg-emphasis)"
							font-family='"Iowan Old Style", Palatino, Georgia, serif'
							font-size="64"
							font-style="italic"
							opacity="0.85"
						>
							Ag
						</text>
					</svg>
					<figcaption mix={[hstack({ gap: 3, align: "center" })]}>
						<Avatar size="lg">
							<Avatar.Fallback>OV</Avatar.Fallback>
						</Avatar>
						<span mix={[vstack({ gap: 0.5 })]}>
							<span mix={[font("display"), text("lg"), fg("neutral.emphasis")]}>Odile Varga</span>
							<span mix={[text("sm"), fg("neutral.muted")]}>Type designer, Lisbon</span>
						</span>
						<span
							mix={[raw({ marginInlineStart: "auto" }), text("sm"), weight("medium"), fg("brand")]}
						>
							@odile.type
						</span>
					</figcaption>
				</figure>
			}
		>
			<ul>
				<li>Drew the Larch and Merrow type families</li>
				<li>Built the design system behind three public banks</li>
				<li>Has taught her typography workshop to 2,000 people</li>
			</ul>
		</FeatureBand>
	);
}
