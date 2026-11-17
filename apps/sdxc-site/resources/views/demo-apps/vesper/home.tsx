/**
 * Vesper's home: the featured title as a billboard, then shelves in the order a returning
 * viewer wants them — what they are part way through, what is popular, their list, the
 * originals, one shelf per genre and a nudge from what they watched last.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { VideoShelf } from "@sdxc/ui/video";

import type { Viewer } from "./state";

import {
	CONTINUE,
	GENRES,
	TRENDING,
	findTitle,
	href,
	similarTitles,
	visibleTitles,
	watchHref,
} from "./data";
import { Billboard, InfoButton, ListButton, PlayButton, ResumeCard, TitleShelf } from "./parts";

/** The genre shelves home shows, in order. */
const GENRE_SHELVES = ["thriller", "drama", "documentary", "comedy", "family"];

/** Resume shelf's paging names. */
const RESUME_LABELS: VideoShelf.Labels = { previous: "Previous titles", next: "More titles" };

/** Renders home for the viewer's profile; a kids' profile sees only kids' titles throughout. */
export default function Home(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		let pool = visibleTitles(viewer.profile);
		let featured = pool[0]!;
		let resume = (CONTINUE[viewer.profile.id] ?? []).filter((entry) =>
			pool.some((title) => title.id === entry.title),
		);
		let trending = TRENDING.map((id) => pool.find((title) => title.id === id)).filter(
			(title) => title !== undefined,
		);
		let listed = viewer.list.map((id) => findTitle(id)).filter((title) => title !== undefined);
		let lastWatched = findTitle(resume[0]?.title ?? "");
		return (
			<div mix={[raw({ display: "grid", gap: "clamp(1.75rem, 3vw, 2.75rem)" })]}>
				<h1 mix={[visuallyHidden()]}>Home</h1>
				<Billboard
					title={featured}
					level={2}
					eyebrow={featured.original ? "Vesper Original" : undefined}
					actions={
						<>
							<PlayButton href={watchHref(featured)} label="Play" />
							<InfoButton href={href(`title/${featured.id}`)} />
							<ListButton title={featured} viewer={viewer} back="" compact />
						</>
					}
				>
					{featured.synopsis}
				</Billboard>
				<div
					mix={[
						raw({
							position: "relative",
							display: "grid",
							gap: "clamp(1.75rem, 3vw, 2.75rem)",
							marginBlockStart: "clamp(-5rem, -6vw, -1rem)",
						}),
					]}
				>
					{resume.length === 0 ? null : (
						<VideoShelf
							id="vesper-continue"
							title={`Continue watching for ${viewer.profile.name}`}
							labels={RESUME_LABELS}
						>
							{resume.map((entry) => (
								<VideoShelf.Item>
									<ResumeCard progress={entry} />
								</VideoShelf.Item>
							))}
						</VideoShelf>
					)}
					<TitleShelf id="trending" title="Trending this week" titles={trending} />
					<TitleShelf id="my-list" title="My List" titles={listed} more="my-list" />
					<TitleShelf
						id="originals"
						title="Vesper Originals"
						titles={pool.filter((title) => title.original)}
						shape="poster"
					/>
					{lastWatched === undefined ? null : (
						<TitleShelf
							id="because"
							title={`Because you watched ${lastWatched.name}`}
							titles={similarTitles(lastWatched, pool)}
						/>
					)}
					{GENRE_SHELVES.map((id) => {
						let genre = GENRES.find((candidate) => candidate.id === id)!;
						return (
							<TitleShelf
								id={`genre-${id}`}
								title={genre.name}
								titles={pool.filter((title) => title.genres.includes(id))}
								more={`genre/${id}`}
							/>
						);
					})}
				</div>
			</div>
		);
	};
}
