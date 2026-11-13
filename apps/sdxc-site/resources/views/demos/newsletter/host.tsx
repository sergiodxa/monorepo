/**
 * The host band: who writes and reads Undercurrent, in her own words, beside a drawn
 * portrait at a microphone, with the credentials that make her worth trusting on pipes
 * and wires and the places a reader can write back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MailIcon, RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { AuthorBand } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** The credentials, in the order the bio earns them. */
const CREDENTIALS = [
	"Eleven years as an engineer in a city water department",
	"Has written a letter every other week since March 2024",
	"Answers every reply, usually on a Monday",
] as const;

/**
 * The portrait in the page’s ink and one blue: the host at a desk microphone in front of a
 * window of ruled lines, drawn in fixed palette steps so it prints the same in both schemes.
 */
function Portrait() {
	return () => (
		<svg
			viewBox="0 0 300 400"
			role="img"
			aria-label="An illustrated portrait of Tove Adler at a desk microphone"
			mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
		>
			<rect width="300" height="400" fill="var(--ui-color-neutral-100)" />
			<g stroke="var(--ui-color-neutral-300)" stroke-width="1">
				{Array.from({ length: 11 }, (_, index) => (
					<path key={index} d={`M24 ${48 + index * 18}H276`} />
				))}
			</g>
			<path
				d="M24 150c40-14 80-14 120 0s80 14 132 0"
				fill="none"
				stroke="var(--ui-color-brand-500)"
				stroke-width="2"
				opacity="0.6"
			/>
			<path d="M52 400c6-86 46-130 98-130s92 44 98 130Z" fill="var(--ui-color-neutral-800)" />
			<rect x="134" y="232" width="32" height="46" fill="var(--ui-color-neutral-600)" />
			<ellipse cx="150" cy="190" rx="44" ry="52" fill="var(--ui-color-neutral-200)" />
			<path
				d="M104 196c-6-60 22-84 48-84 30 0 54 22 46 84-4-30-22-50-46-50s-42 18-48 50Z"
				fill="var(--ui-color-neutral-800)"
			/>
			<g fill="none" stroke="var(--ui-color-neutral-800)" stroke-width="3" stroke-linecap="round">
				<path d="M100 186c0-46 100-46 100 0" />
				<path d="M136 230q14 7 28 0" />
				<path d="M130 196h12M158 196h12" />
			</g>
			<rect x="92" y="178" width="14" height="28" rx="6" fill="var(--ui-color-brand-500)" />
			<rect x="194" y="178" width="14" height="28" rx="6" fill="var(--ui-color-brand-500)" />
			<rect x="0" y="330" width="300" height="70" fill="var(--ui-color-neutral-200)" />
			<path d="M0 330H300" stroke="var(--ui-color-neutral-800)" />
			<path d="M214 330V290" stroke="var(--ui-color-neutral-800)" stroke-width="3" />
			<rect x="200" y="252" width="28" height="44" rx="14" fill="var(--ui-color-neutral-800)" />
		</svg>
	);
}

/** "Tove" as a single pen stroke, in the ink colour the band hands it. */
function Signature() {
	return () => (
		<svg viewBox="0 0 120 48" aria-hidden="true">
			<path
				d="M6 14h26M19 14c-1 10-3 20-2 24M34 30c-6 0-7 8-1 8s7-8 1-8M46 28c2 6 4 10 6 10s6-14 8-16M66 32c4 0 8-3 7-6s-7-1-7 5 6 8 12 4"
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
 * Renders the band with the portrait first: beside the copy where the column allows and
 * above it on a phone. The credentials are a ruled list, each line a fact a reader can check.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterHost() {
	return () => (
		<AuthorBand
			id="host"
			mix={[renderNearView(1061, 1188)]}
			ruled
			portrait={<Portrait />}
			eyebrow="Who writes it"
			title="Written by someone who has opened the valves"
			description={
				<>
					I’m Tove Adler. I spent eleven years keeping a city’s water running, and I started
					Undercurrent because nobody outside the department ever asked how it worked.{" "}
					<strong>Readers ask now</strong>, and half the letters start with their questions.
				</>
			}
			credentials={
				<ul
					mix={[
						m(0),
						p(0),
						raw({ listStyle: "none", borderBlockStart: "1px solid var(--ui-landing-hairline)" }),
						when(
							"& > li",
							raw({
								paddingBlock: "0.75rem",
								borderBlockEnd: "1px solid var(--ui-landing-hairline)",
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
			name="Tove Adler"
			jobTitle="Writer and host"
			social={[
				{ href: "/examples/newsletter/reply", label: "Write to Tove", icon: <MailIcon /> },
				{ href: "/examples/newsletter/feed.xml", label: "Podcast feed", icon: <RssIcon /> },
			]}
		/>
	);
}
