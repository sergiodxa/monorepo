/**
 * The release strip: Plumb's last four releases on a dated line, each with its version and
 * what changed for a user, the major one naming its migration, so the project reads as
 * maintained before anyone opens the repository.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { font, text } from "@sdxc/u/typography";
import { ChangelogStrip, LandingSection } from "@sdxc/ui/landing";

/** The releases, newest first. */
const RELEASES = [
	{
		dateTime: "2026-11-04",
		date: "v4.2.0 · Nov 4",
		title: "Async refinements",
		body: "refine() takes an async check, like a unique email.",
	},
	{
		dateTime: "2026-10-07",
		date: "v4.1.0 · Oct 7",
		title: "plumb inspect",
		body: "Prints the function a schema compiles to.",
	},
	{
		dateTime: "2026-08-26",
		date: "v4.0.0 · Aug 26",
		title: "Compiled by default",
		body: "6.5× faster parsing, and a codemod for the renames.",
	},
	{
		dateTime: "2026-08-02",
		date: "v3.9.2 · Aug 2",
		title: "Cleaner optional output",
		body: "Absent optional fields stay absent in the output.",
	},
] as const;

/**
 * Renders the strip with a link to every release.
 *
 * @returns The render function producing the band.
 */
export function ChangelogChapter() {
	return () => (
		<LandingSection id="changelog" ruled spacing="compact">
			<ChangelogStrip
				title="CHANGELOG.md"
				action={
					<a
						href="#changelog"
						mix={[hstack({ gap: 1.5, align: "center" }), font("mono"), text("sm")]}
					>
						All 61 releases
						<ArrowRightIcon
							aria-hidden="true"
							mix={[raw({ inlineSize: "1em", blockSize: "1em" })]}
						/>
					</a>
				}
			>
				{RELEASES.map((release) => (
					<ChangelogStrip.Entry
						key={release.dateTime}
						dateTime={release.dateTime}
						date={release.date}
						title={release.title}
					>
						{release.body}
					</ChangelogStrip.Entry>
				))}
			</ChangelogStrip>
		</LandingSection>
	);
}
