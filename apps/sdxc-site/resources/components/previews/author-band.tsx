/**
 * Live preview for `AuthorBand`: a book's author beside her statement and bio, with three
 * credentials, a signature, profile links and a two-minute intro video. The portrait and
 * the video still are drawn illustrations, so the page names an invented author.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlobeIcon, MailIcon, RssIcon } from "@sdxc/icons";
import { AuthorBand, CheckList, CheckRow } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<AuthorBand
	portrait={<img src={portrait} alt="Odile Varga at her drafting table" />}
	eyebrow="About the author"
	title="Written by a type designer who ships code"
	description={
		<>
			Odile Varga has drawn typefaces for fifteen years and built design systems for ten.
			She wrote The Measure for <strong>the engineers who set the type</strong>.
		</>
	}
	credentials={
		<CheckList>
			<CheckRow>Drew the Larch and Merrow type families</CheckRow>
			<CheckRow>Built the design system behind three public banks</CheckRow>
			<CheckRow>Has taught her typography workshop to 2,000 people</CheckRow>
		</CheckList>
	}
	name="Odile Varga"
	jobTitle="Type designer, Lisbon"
	signature={<svg viewBox="0 0 160 56" aria-hidden="true">…</svg>}
	social={[
		{ href: "https://odile.type", label: "Website", icon: <GlobeIcon /> },
		{ href: "https://odile.type/feed", label: "Newsletter", icon: <RssIcon /> },
		{ href: "mailto:hello@odile.type", label: "Email", icon: <MailIcon /> },
	]}
	video={{
		thumbnail: <img src={still} alt="" />,
		title: "Why type is code",
		duration: "2:13",
		href: "/videos/intro",
	}}
/>`;

/** A drawn 3:4 portrait in the brand tints, standing in for a photo. */
function portrait() {
	return (
		<svg
			viewBox="0 0 300 400"
			role="img"
			aria-label="An illustrated portrait of Odile Varga at her drafting table"
			preserveAspectRatio="xMidYMid slice"
		>
			<rect width="300" height="400" fill="var(--ui-brand-bg-tint)" />
			<circle cx="230" cy="90" r="140" fill="var(--ui-brand-border)" opacity="0.5" />
			<rect x="0" y="320" width="300" height="80" fill="var(--ui-brand-bg-solid)" opacity="0.18" />
			<path d="M50 400c8-96 52-142 100-142s92 46 100 142Z" fill="var(--ui-brand-bg-solid)" />
			<rect x="132" y="210" width="36" height="52" rx="14" fill="#d9a588" />
			<ellipse cx="150" cy="168" rx="52" ry="60" fill="#e5b597" />
			<path
				d="M96 170c-8-58 24-92 60-92 40 0 66 32 54 86-8-26-26-44-52-46-24 8-44 24-62 52Z"
				fill="#3b2318"
			/>
			<g fill="none" stroke="#3b2318" stroke-width="3.5">
				<circle cx="128" cy="176" r="14" />
				<circle cx="172" cy="176" r="14" />
				<path d="M142 176h16" />
			</g>
			<path d="M136 206q14 8 28 0" stroke="#7a3b25" stroke-width="3" fill="none" />
		</svg>
	);
}

/** A drawn video still: the word "Ag" on a drafting grid, cropped to 16:9 by the card. */
function still() {
	return (
		<svg viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
			<rect width="320" height="180" fill="#1f2937" />
			<g stroke="#ffffff" stroke-opacity="0.08">
				<path d="M0 45h320M0 90h320M0 135h320M80 0v180M160 0v180M240 0v180" />
			</g>
			<text
				x="252"
				y="112"
				text-anchor="middle"
				fill="#f3e8d8"
				font-family='"Iowan Old Style", Palatino, Georgia, serif'
				font-size="80"
				font-style="italic"
			>
				Ag
			</text>
		</svg>
	);
}

/** A handwritten signature drawn as one stroke in `currentColor`. */
function signature() {
	return (
		<svg viewBox="0 0 160 56" aria-hidden="true">
			<path
				d="M6 40c10-26 22-34 26-26s-12 30-6 32 18-30 24-28-6 24 0 24 12-18 18-18-4 16 2 16 10-12 16-14 2 12 8 12 14-10 22-12 18 2 30-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the band to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<AuthorBand
			portrait={portrait()}
			eyebrow="About the author"
			title="Written by a type designer who ships code"
			description={
				<>
					Odile Varga has drawn typefaces for fifteen years and built design systems for ten. She
					wrote The Measure for <strong>the engineers who set the type</strong>.
				</>
			}
			credentials={
				<CheckList>
					<CheckRow>Drew the Larch and Merrow type families</CheckRow>
					<CheckRow>Built the design system behind three public banks</CheckRow>
					<CheckRow>Has taught her typography workshop to 2,000 people</CheckRow>
				</CheckList>
			}
			name="Odile Varga"
			jobTitle="Type designer, Lisbon"
			signature={signature()}
			social={[
				{ href: "/examples/odile", label: "Website", icon: <GlobeIcon /> },
				{ href: "/examples/odile/feed", label: "Newsletter", icon: <RssIcon /> },
				{ href: "mailto:hello@example.com", label: "Email", icon: <MailIcon /> },
			]}
			video={{
				thumbnail: still(),
				title: "Why type is code",
				duration: "2:13",
				href: "/examples/videos/intro",
			}}
		/>
	),
};
