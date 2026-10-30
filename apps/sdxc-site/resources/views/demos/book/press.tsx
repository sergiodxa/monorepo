/**
 * The press line under the hero: the publications that reviewed the book, set as one
 * sentence with their mastheads in it, the way a jacket flap credits its reviewers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { nowrap } from "@sdxc/u/typography";
import { MarketingSection } from "@sdxc/ui";
import { LogoSentence } from "@sdxc/ui/patterns";

import { SERIF } from "~/resources/views/demos/book/type";

/** One invented masthead: its name, how it is lettered, and the width its lettering takes. */
interface Masthead {
	name: string;
	width: number;
	style: "italic" | "caps" | "bold";
}

/** The reviewing publications, in the order the sentence names them. */
const MASTHEADS: readonly Masthead[] = [
	{ name: "The Proof", width: 150, style: "italic" },
	{ name: "BASELINE", width: 190, style: "caps" },
	{ name: "Margin & Gutter", width: 250, style: "bold" },
];

/**
 * Letters one masthead at a fixed width through `textLength`, so the mark keeps its
 * proportions whichever serif the reader's system substitutes.
 *
 * @param masthead The publication to letter.
 * @returns The masthead as an inline SVG named by its title.
 */
function mastheadMark(masthead: Masthead) {
	return (
		<svg
			viewBox={`0 0 ${masthead.width} 40`}
			role="img"
			aria-label={masthead.name}
			style={{ "--logo-scale": "1.15" }}
		>
			<text
				x="0"
				y="31"
				textLength={masthead.width}
				lengthAdjust="spacingAndGlyphs"
				fill="currentColor"
				font-family={SERIF}
				font-size="36"
				font-style={masthead.style === "italic" ? "italic" : "normal"}
				font-weight={masthead.style === "bold" ? "700" : "400"}
			>
				{masthead.name}
			</text>
		</svg>
	);
}

/**
 * A comma set tight against the masthead before it: it takes back the 0.1em the sentence
 * spaces each mark by, so the comma sits where it would after a word.
 */
function Comma() {
	return () => <span mix={[raw({ marginInlineStart: "-0.1em" })]}>,</span>;
}

/**
 * Renders the sentence in a compact ruled band. Each masthead keeps the punctuation after
 * it on its own line, so no line opens on a comma.
 *
 * @returns The render function producing the band.
 */
export default function BookPress() {
	return () => {
		let [proof, baseline, margin] = MASTHEADS.map(mastheadMark);

		return (
			<MarketingSection id="press" spacing="compact" ruled aria-label="Press">
				<LogoSentence>
					Reviewed in{" "}
					<span mix={[nowrap()]}>
						{proof}
						<Comma />
					</span>{" "}
					<span mix={[nowrap()]}>{baseline}</span> and{" "}
					<span mix={[nowrap()]}>
						{margin}
						<Comma />
					</span>{" "}
					and taught in forty design schools.
				</LogoSentence>
			</MarketingSection>
		);
	};
}
