/**
 * The community band: the repository's four counts as display figures, then a mosaic of
 * the people who committed to Plumb ending on everyone else, so the stars come with the
 * names behind them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { ContributorWall, LandingHeader, LandingSection, StatStrip } from "@sdxc/ui/landing";

import { CONTRIBUTORS, REPO } from "~/resources/views/demos/library/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the band. The figures sit over the wall at the same measure, and the closing
 * tile counts the contributors the wall leaves out.
 *
 * @returns The render function producing the band.
 */
export function CommunityChapter() {
	return () => (
		<LandingSection id="community" ruled mix={[renderNearView(566, 701)]}>
			<LandingHeader
				eyebrow="CONTRIBUTORS.md"
				description={
					<>
						Two maintainers review every pull request;{" "}
						<strong>most of the code came from everyone else</strong>, from typo fixes to the
						compiler's array fast path.
					</>
				}
			>
				{`${REPO.contributors} people have shipped plumb`}
			</LandingHeader>
			<div mix={[vstack({ gap: 12, align: "stretch" })]}>
				<StatStrip size="display" variant="ruled">
					<StatStrip.Item label="Stars on GitHub">{REPO.stars}</StatStrip.Item>
					<StatStrip.Item label="Weekly downloads">{REPO.weeklyDownloads}</StatStrip.Item>
					<StatStrip.Item label="Contributors">{REPO.contributors}</StatStrip.Item>
					<StatStrip.Item label="Open issues">{REPO.openIssues}</StatStrip.Item>
				</StatStrip>
				<ContributorWall
					aria-label="Contributors to plumb, most commits first"
					columns={[9, 12, 18]}
				>
					{CONTRIBUTORS.map((name) => (
						<ContributorWall.Person key={name} href="#community" name={name} />
					))}
					<ContributorWall.More
						href="#community"
						count={`+${REPO.contributors - CONTRIBUTORS.length}`}
						aria-label={`All ${REPO.contributors} contributors`}
					/>
				</ContributorWall>
			</div>
		</LandingSection>
	);
}
