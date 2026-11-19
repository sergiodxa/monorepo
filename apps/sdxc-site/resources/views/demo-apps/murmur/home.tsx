/**
 * Murmur's home: a greeting, six quick picks from the listener's library to start in one
 * press, and shelves of editorial playlists, new releases, followed artists and saved albums.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { Listener } from "./state";

import { LIKED_ART, albumArt, playlistArt } from "./art";
import { ALBUMS, LISTENER, PLAYLISTS, findAlbum, findArtist, findPlaylist, href } from "./data";
import {
	AlbumTile,
	ArtistTile,
	Cover,
	Gutter,
	PlayCircle,
	PlayForm,
	PlaylistTile,
	Shelf,
	ShelfItem,
} from "./parts";

/** One quick pick: where it opens, what it plays, and its art. */
interface Pick {
	page: string;
	context: string;
	name: string;
	art: string;
}

/** The listener's six quick picks: Liked Songs, then what they saved most recently. */
function quickPicks(listener: Listener): Pick[] {
	let saved = listener.saved.flatMap((key): Pick[] => {
		let [kind, id = ""] = key.split(":");
		if (kind === "album") {
			let entry = findAlbum(id);
			return entry === undefined
				? []
				: [{ page: `album/${id}`, context: key, name: entry.title, art: albumArt(entry) }];
		}
		let playlist = findPlaylist(id);
		return playlist === undefined
			? []
			: [
					{
						page: `playlist/${id}`,
						context: key,
						name: playlist.title,
						art: playlistArt(playlist),
					},
				];
	});
	return [{ page: "liked", context: "liked", name: "Liked Songs", art: LIKED_ART }, ...saved].slice(
		0,
		6,
	);
}

namespace Home {
	export interface Props {
		listener: Listener;
	}
}

/** Renders the home screen. */
export default function Home(handle: Handle<Home.Props>) {
	return () => {
		let { listener } = handle.props;
		let back = "";
		let newest = [...ALBUMS].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
		let savedAlbums = listener.saved
			.filter((key) => key.startsWith("album:"))
			.map((key) => findAlbum(key.slice("album:".length)))
			.filter((entry) => entry !== undefined);
		return (
			<Gutter>
				<h1
					mix={[
						raw({
							margin: "0",
							fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
							fontWeight: "850",
							letterSpacing: "-0.03em",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					Welcome back, {LISTENER.name}
				</h1>
				<ul
					aria-label="Quick picks"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 15rem), 1fr))",
							gap: "0.5rem 0.75rem",
							margin: "0",
							marginBlockStart: "-0.75rem",
							padding: "0",
							listStyle: "none",
							"@media (max-width: 40rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
						}),
					]}
				>
					{quickPicks(listener).map((pick) => (
						<QuickPick pick={pick} back={back} />
					))}
				</ul>
				<Shelf id="made-for-you" title="Made for you">
					{PLAYLISTS.filter((playlist) => !playlist.mine).map((playlist) => (
						<ShelfItem>
							<PlaylistTile playlist={playlist} back={back} />
						</ShelfItem>
					))}
				</Shelf>
				<Shelf id="new-releases" title="New releases">
					{newest.map((entry) => (
						<ShelfItem>
							<AlbumTile album={entry} back={back} />
						</ShelfItem>
					))}
				</Shelf>
				<Shelf id="your-artists" title="Artists you follow">
					{listener.followed
						.map(findArtist)
						.filter((artist) => artist !== undefined)
						.map((artist) => (
							<ShelfItem>
								<ArtistTile artist={artist} back={back} />
							</ShelfItem>
						))}
				</Shelf>
				{savedAlbums.length === 0 ? null : (
					<Shelf id="jump-back-in" title="Jump back in">
						{savedAlbums.map((entry) => (
							<ShelfItem>
								<AlbumTile album={entry} back={back} subtitle={`${entry.kind} · ${entry.year}`} />
							</ShelfItem>
						))}
					</Shelf>
				)}
			</Gutter>
		);
	};
}

/**
 * One quick pick: the art and name as a link, and a play circle that rises at its end under
 * the pointer, separate from the link so each has its own name.
 */
function QuickPick(handle: Handle<{ pick: Pick; back: string }>) {
	return () => {
		let { back, pick } = handle.props;
		return (
			<li
				mix={[
					raw({
						position: "relative",
						display: "flex",
						alignItems: "center",
						overflow: "clip",
						borderRadius: "var(--ui-radius-md)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						transition: "background-color 140ms ease",
						"&:hover, &:focus-within": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"& [data-pick-play]": {
							position: "absolute",
							insetInlineEnd: "0.5rem",
							opacity: "0",
							transition: "opacity 140ms ease",
						},
						"&:hover [data-pick-play], &:focus-within [data-pick-play]": { opacity: "1" },
						"@media (hover: none)": { "& [data-pick-play]": { display: "none" } },
					}),
				]}
			>
				<a
					href={href(pick.page)}
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							flex: "1",
							minInlineSize: "0",
							paddingInlineEnd: "4rem",
							color: "var(--ui-neutral-fg-emphasis)",
							fontSize: "0.875rem",
							fontWeight: "700",
							lineHeight: "1.25rem",
							textDecoration: "none",
							"& > img": {
								flex: "none",
								inlineSize: "3.5rem",
								blockSize: "3.5rem",
								boxShadow: "4px 0 12px -6px rgb(0 0 0 / 0.4)",
							},
							"& > span": {
								overflow: "hidden",
								textOverflow: "ellipsis",
								display: "-webkit-box",
								WebkitLineClamp: "2",
								WebkitBoxOrient: "vertical",
							},
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
								borderRadius: "inherit",
							},
							"@media (max-width: 40rem)": {
								paddingInlineEnd: "0.5rem",
								fontSize: "0.8125rem",
								"& > img": { inlineSize: "3rem", blockSize: "3rem" },
							},
						}),
					]}
				>
					<Cover src={pick.art} eager />
					<span>{pick.name}</span>
				</a>
				<span data-pick-play="">
					<PlayForm context={pick.context} back={back}>
						<PlayCircle context={pick.context} name={pick.name} size="md" />
					</PlayForm>
				</span>
			</li>
		);
	};
}
