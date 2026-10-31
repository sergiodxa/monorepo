/**
 * What each way-of-reading page shows: the queue someone reading that way wakes up to, the
 * three features that matter most to them, and the scene the page's spotlight band holds.
 * Keyed by slug so a test can hold every page to a full set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { PlayIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";

import type { FeatureSlug, UseCaseSlug } from "~/config/marketing";
import type { SamplePost } from "~/resources/components/marketing/sample-data";

import { FeedView, HAIRLINE, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { AgentsScene, SearchScene, scenePanel } from "~/resources/components/marketing/scenes";

/** One way of reading: its morning queue, its features, and its spotlight. */
export interface UseCase {
	posts: SamplePost[];
	features: readonly [FeatureSlug, FeatureSlug, FeatureSlug];
	spotlight: (t: Translate) => RemixNode;
}

/** An episode the post page plays with the browser's own player, drawn mid-listen. */
function EpisodeScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<div aria-hidden="true" mix={[scenePanel()]}>
				<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-brand-fg)" })]}>
					{t("post.source", { feed: "The Long Simmer" })}
				</span>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-serif)",
							fontSize: "1.25rem",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					Ep. 112 — Stock, slowly
				</span>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							padding: "0.625rem 0.75rem",
							border: HAIRLINE,
							borderRadius: "999px",
						}),
					]}
				>
					<PlayIcon size={16} />
					<span
						mix={[
							raw({
								fontVariantNumeric: "tabular-nums",
								fontSize: "0.75rem",
								whiteSpace: "nowrap",
							}),
						]}
					>
						12:04 / 48:31
					</span>
					<span
						mix={[
							raw({
								position: "relative",
								flex: "1",
								blockSize: "4px",
								borderRadius: "999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlock: "0",
									insetInlineStart: "0",
									inlineSize: "25%",
									borderRadius: "999px",
									backgroundColor: "var(--ui-brand-fg)",
								}),
							]}
						/>
					</span>
				</div>
				<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
					longsimmer.example.com/ep112.mp3 · 44 MB
				</span>
			</div>
		);
	};
}

/** Every way-of-reading page's content, by slug. */
export const USE_CASES: Record<UseCaseSlug, UseCase> = {
	news: {
		features: ["freshness", "filters", "notifications"],
		spotlight: (t) => (
			<ReaderWindow
				t={t}
				title="Harbor Daily"
				path="/reading/harbor-daily"
				active="feed"
				label={t("landing.useCases.pages.news.spotlightAlt")}
			>
				<FeedView t={t} />
			</ReaderWindow>
		),
		posts: [
			{
				title: "Ferry timetable changes for the winter season",
				summary: "Two crossings move earlier.",
				feed: "Harbor Daily",
				time: "6m",
				read: false,
			},
			{
				title: "Council approves the harbour footbridge",
				summary: "Construction starts in spring.",
				feed: "City Desk",
				time: "3h",
				read: false,
			},
			{
				title: "Storm warning lifted for the coast",
				summary: "Ports reopen at noon.",
				feed: "Harbor Daily",
				time: "4h",
				read: false,
			},
			{
				title: "Library extends its weekend hours",
				summary: "Open until 8 p.m. on Saturdays.",
				feed: "City Desk",
				time: "7h",
				read: true,
			},
			{
				title: "Night buses return to the northern line",
				summary: "Every 20 minutes until 2 a.m.",
				feed: "Harbor Daily",
				time: "11h",
				read: true,
			},
		],
	},
	developers: {
		features: ["filters", "notifications", "agents"],
		spotlight: (t) => <AgentsScene t={t} framed={false} />,
		posts: [
			{
				title: "Kettle 4.2: a streaming parser and a smaller install",
				summary: "The parser reads a document as it arrives.",
				feed: "Kettle releases",
				time: "41m",
				read: false,
				flagged: true,
			},
			{
				title: "Kettle 4.1.3 fixes an unbounded read",
				summary: "Upgrade if you parse untrusted input.",
				feed: "Kettle releases",
				time: "2d",
				read: false,
				flagged: true,
			},
			{
				title: "How we cut our cold start in half",
				summary: "Lazy routes and one less dependency.",
				feed: "Rowboat engineering",
				time: "5h",
				read: false,
			},
			{
				title: "Postmortem: the 14 minutes the queue stalled",
				summary: "A lease that never expired.",
				feed: "Rowboat engineering",
				time: "1d",
				read: false,
				saved: true,
			},
			{
				title: "Notes on reading other people's diffs",
				summary: "Start with the tests.",
				feed: "Field Notes",
				time: "3d",
				read: true,
			},
		],
	},
	research: {
		features: ["search", "organize", "your-data"],
		spotlight: (t) => <SearchScene t={t} framed={false} />,
		posts: [
			{
				title: "What the spring survey found in the rock pools",
				summary: "Fewer limpets, more anemones.",
				feed: "Tidepool Lab",
				time: "1h",
				read: false,
				saved: true,
			},
			{
				title: "A cheaper way to count plankton",
				summary: "Phone cameras and a sheet of glass.",
				feed: "Open Marine Notes",
				time: "6h",
				read: false,
			},
			{
				title: "Preprint: limpet homing over 30 days",
				summary: "Tagged animals return to the same scar.",
				feed: "Coastal Ecology Preprints",
				time: "9h",
				read: false,
			},
			{
				title: "Reading list: intertidal zonation",
				summary: "Twelve papers, oldest first.",
				feed: "Field Notes",
				time: "2d",
				read: true,
				saved: true,
			},
			{
				title: "Data release: ten years of tide gauges",
				summary: "CSV, one file per station.",
				feed: "Open Marine Notes",
				time: "4d",
				read: true,
			},
		],
	},
	podcasts: {
		features: ["notifications", "organize", "freshness"],
		spotlight: (t) => <EpisodeScene t={t} />,
		posts: [
			{
				title: "Ep. 112 — Stock, slowly",
				summary: "Bones, water and eight hours.",
				feed: "The Long Simmer",
				time: "5h",
				read: false,
			},
			{
				title: "The harbour at night, recorded",
				summary: "Forty minutes of ropes and gulls.",
				feed: "Field Recordings",
				time: "1d",
				read: false,
			},
			{
				title: "Ep. 111 — Salt",
				summary: "When, how much, and why.",
				feed: "The Long Simmer",
				time: "7d",
				read: false,
				saved: true,
			},
			{
				title: "Interview: the last ferry captain",
				summary: "Thirty years on one crossing.",
				feed: "Harbor Daily audio",
				time: "8d",
				read: true,
			},
			{
				title: "Ep. 110 — Knives",
				summary: "Three is enough.",
				feed: "The Long Simmer",
				time: "14d",
				read: true,
			},
		],
	},
};
