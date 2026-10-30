/**
 * The "what you'll learn" band: six skills the book teaches, each a claim a reader can
 * check against their own product once they have read the chapter behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import {
	AArrowUpIcon,
	BaselineIcon,
	GaugeIcon,
	LigatureIcon,
	RulerIcon,
	TypeIcon,
} from "@sdxc/icons";
import { Feature } from "@sdxc/ui";
import { FeatureBand } from "@sdxc/ui/patterns";

/** One skill: its icon, its title and the sentence that sells it. */
interface Skill {
	icon: RemixNode;
	title: string;
	body: RemixNode;
}

/** The skills in the order the book teaches them. */
const SKILLS: readonly Skill[] = [
	{
		icon: <RulerIcon />,
		title: "Hold the measure",
		body: (
			<>
				Keep paragraphs between 45 and 75 characters with{" "}
				<strong>ch units and container queries</strong>, so a column reads well on every screen.
			</>
		),
	},
	{
		icon: <BaselineIcon />,
		title: "Keep a vertical rhythm",
		body: (
			<>
				Space blocks from the line height, and learn the <strong>one rule</strong> that keeps
				headings from drifting off the grid.
			</>
		),
	},
	{
		icon: <AArrowUpIcon />,
		title: "Build a scale that holds",
		body: (
			<>
				A fluid type scale with <strong>clamp()</strong> whose steps stay distinct on a phone and
				calm on a wide monitor.
			</>
		),
	},
	{
		icon: <TypeIcon />,
		title: "Choose and pair typefaces",
		body: (
			<>
				Judge a font by its <strong>x-height, spacing and figures</strong>, then pair two families
				without guessing.
			</>
		),
	},
	{
		icon: <LigatureIcon />,
		title: "Use OpenType features",
		body: (
			<>
				Tabular figures in tables, real small caps and ligatures, all switched on with{" "}
				<strong>font-variant</strong>.
			</>
		),
	},
	{
		icon: <GaugeIcon />,
		title: "Load fonts without the jump",
		body: (
			<>
				Subset files, preload the right weight and match fallback metrics, so text{" "}
				<strong>never shifts</strong> when the font arrives.
			</>
		),
	},
];

/**
 * Renders the skills as a three-column card grid from the `lg` container, two from `md`
 * and one on a phone.
 *
 * @returns The render function producing the band.
 */
export default function BookLearn() {
	return () => (
		<FeatureBand
			id="learn"
			layout="grid"
			columns={3}
			eyebrow="What you’ll learn"
			title="Fourteen chapters, one habit: look closer"
			description={
				<>
					Each chapter takes one decision you make every day without noticing, shows what it costs a
					reader, and ends with <strong>the CSS that fixes it</strong>.
				</>
			}
		>
			{SKILLS.map((skill) => (
				<Feature key={skill.title}>
					<Feature.Icon>{skill.icon}</Feature.Icon>
					<Feature.Title>{skill.title}</Feature.Title>
					<Feature.Description>{skill.body}</Feature.Description>
				</Feature>
			))}
		</FeatureBand>
	);
}
