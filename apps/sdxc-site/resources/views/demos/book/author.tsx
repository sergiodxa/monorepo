/**
 * The author band: who wrote the book and why a reader should trust her on type, beside
 * an engraved-style portrait, signed off with her signature and her profiles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlobeIcon, MailIcon, RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { AuthorBand } from "@sdxc/ui/patterns";

import { SERIF } from "~/resources/views/demos/book/type";

/** The credentials, in the order the bio earns them. */
const CREDENTIALS = [
	"Drew the Larch and Merrow type families",
	"Built the design system behind three public banks",
	"Has taught her typography workshop to 2,000 people",
] as const;

/**
 * The portrait as a two-colour print in the page's ink and red, at the band's 3:4 crop.
 * It reads from the theme's tokens, so it prints dark on paper and light in a dark room.
 */
function Portrait() {
	return () => (
		<svg
			viewBox="0 0 300 400"
			role="img"
			aria-label="An illustrated portrait of Odile Varga at her drafting table"
			mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
		>
			<rect width="300" height="400" fill="var(--ui-neutral-bg-tint-hover)" />
			{Array.from({ length: 24 }, (_, index) => (
				<line
					key={index}
					x1="0"
					x2="300"
					y1={16 + index * 16}
					y2={16 + index * 16}
					stroke="var(--ui-marketing-hairline)"
				/>
			))}
			<circle cx="216" cy="118" r="86" fill="var(--ui-brand-bg-solid)" opacity="0.9" />
			<path d="M58 400c8-84 52-128 92-128s84 44 92 128Z" fill="var(--ui-neutral-fg-emphasis)" />
			<rect x="136" y="226" width="28" height="52" fill="var(--ui-neutral-fg)" />
			<ellipse cx="150" cy="186" rx="44" ry="52" fill="var(--ui-neutral-bg-tint)" />
			<path
				d="M104 188c-8-52 18-82 50-82 34 0 56 28 46 76-8-24-24-40-46-42-20 6-36 22-50 48Z"
				fill="var(--ui-neutral-fg-emphasis)"
			/>
			<g fill="none" stroke="var(--ui-neutral-fg-emphasis)" stroke-width="3">
				<circle cx="132" cy="194" r="12" />
				<circle cx="170" cy="194" r="12" />
				<path d="M144 194h14" />
				<path d="M140 222q10 6 20 0" />
			</g>
			<rect x="0" y="352" width="300" height="48" fill="var(--ui-neutral-bg-tint-hover)" />
			<line x1="0" x2="300" y1="352" y2="352" stroke="var(--ui-neutral-fg-emphasis)" />
			<text
				x="276"
				y="384"
				text-anchor="end"
				fill="var(--ui-neutral-fg-emphasis)"
				font-family={SERIF}
				font-size="18"
				font-style="italic"
			>
				Pl. 1 — The author
			</text>
		</svg>
	);
}

/** "Odile V." as a single pen stroke, in the ink colour the band hands it. */
function Signature() {
	return () => (
		<svg viewBox="0 0 160 56" aria-hidden="true">
			<path
				d="M8 34c0-14 12-22 20-18s4 22-8 24-12-14 2-18M34 30c6-2 8 8 14 4s4-14 4-14M58 12c-2 10-6 26-4 28s8-6 10-10M68 30c4 4 10 2 12-4M92 18c4 12 8 20 10 20s10-22 14-30M118 36c2 2 4 2 6 0"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
}

/**
 * Renders the band with the portrait first: beside the copy from the `lg` container and
 * above it on a phone. The credentials are a ruled list, each line a printed entry.
 *
 * @returns The render function producing the band.
 */
export default function BookAuthor() {
	return () => (
		<AuthorBand
			id="author"
			ruled
			portrait={<Portrait />}
			eyebrow="About the author"
			title="Written by a type designer who ships code"
			description={
				<>
					Odile Varga has drawn typefaces for fifteen years and built design systems for ten. She
					wrote The Measure for the people she kept explaining it to:{" "}
					<strong>the engineers who set the type</strong> that designers only drew.
				</>
			}
			credentials={
				<ul
					mix={[
						m(0),
						p(0),
						raw({ listStyle: "none", borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
						when(
							"& > li",
							raw({
								paddingBlock: "0.75rem",
								borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
							}),
						),
						fg("neutral"),
					]}
				>
					{CREDENTIALS.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			}
			signature={<Signature />}
			name="Odile Varga"
			jobTitle="Type designer, Lisbon"
			social={[
				{ href: "/examples/book/odile", label: "Website", icon: <GlobeIcon /> },
				{ href: "/examples/book/letters", label: "Newsletter", icon: <MailIcon /> },
				{ href: "/examples/book/feed.xml", label: "RSS feed", icon: <RssIcon /> },
			]}
		/>
	);
}
