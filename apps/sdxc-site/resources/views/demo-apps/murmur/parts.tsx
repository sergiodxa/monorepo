/**
 * The pieces every Murmur screen is built from: a cover image, the play and like forms that
 * work without script and that the player takes over with it, the collection header, the
 * track table for any list, shelves of tiles, and the page gutter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HeartIcon, PauseIcon, PlayIcon, ShuffleIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope } from "@sdxc/ui";
import { MediaTile } from "@sdxc/ui/audio/media-tile";
import { TrackList } from "@sdxc/ui/audio/track-list";
import { VideoShelf } from "@sdxc/ui/video/video-shelf";

import type { Album, Artist, Playlist, Track } from "./data";

import { albumArt, artistArt, playlistArt } from "./art";
import { actionHref, addedLabel, artistName, findAlbum, findArtist, href } from "./data";

/** The labels the track table reads, the same on every screen. */
const TRACK_LABELS: TrackList.Labels = {
	index: "#",
	title: "Title",
	album: "Album",
	added: "Date added",
	duration: "Duration",
	playing: "Now playing",
};

/** The shelf paging buttons' names. */
const SHELF_LABELS = { previous: "Scroll back", next: "Scroll forward" };

namespace Cover {
	export interface Props {
		src: string;
		/** Empty for art beside its own name, which is most of it. */
		alt?: string;
		/** Loads at once rather than on approach, for the art at the top of a screen. */
		eager?: boolean;
	}
}

/** A drawn cover or portrait as an image, square, decoded off the main thread. */
export function Cover(handle: Handle<Cover.Props>) {
	return () => (
		<img
			src={handle.props.src}
			alt={handle.props.alt ?? ""}
			width="300"
			height="300"
			loading={handle.props.eager ? "eager" : "lazy"}
			decoding="async"
		/>
	);
}

namespace PlayForm {
	export interface Props {
		/** The list to play from, such as `album:tidelight`. */
		context: string;
		/** The track to start on; the list's first, or a shuffled pick, when omitted. */
		track?: string;
		/** Starts the list shuffled. */
		shuffle?: boolean;
		/** The page path the visitor returns to after a post without script. */
		back: string;
		/** The button. */
		children: RemixNode;
	}
}

/**
 * A form that starts a list playing. Without script it posts, and the server puts the track
 * in the player; with script the player takes the submit and plays at once, in place.
 */
export function PlayForm(handle: Handle<PlayForm.Props>) {
	return () => {
		let { back, children, context, shuffle, track } = handle.props;
		return (
			<form
				method="post"
				action={actionHref("play")}
				data-murmur-play=""
				data-context={context}
				data-track={track}
				data-shuffle={shuffle ? "" : undefined}
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="context" value={context} />
				{track === undefined ? null : <input type="hidden" name="track" value={track} />}
				{shuffle ? <input type="hidden" name="shuffle" value="1" /> : null}
				<input type="hidden" name="back" value={back} />
				{children}
			</form>
		);
	};
}

namespace PlayCircle {
	export interface Props {
		/** The list it plays, whose playing state turns the button into Pause. */
		context: string;
		/** What it plays, for its name: "Play Tidelight". */
		name: string;
		/** @default "lg" */
		size?: "md" | "lg";
	}
}

/**
 * The round brand button that plays a whole list. While the player plays that list, it shows
 * Pause; the player marks the page with `data-now-context` and `data-audio-paused`.
 */
export function PlayCircle(handle: Handle<PlayCircle.Props>) {
	return () => {
		let { context, name, size = "lg" } = handle.props;
		let side = size === "lg" ? "3.5rem" : "3rem";
		let playing = `:root[data-now-context="${context}"]:not([data-audio-paused]) &`;
		return (
			<button
				type="submit"
				aria-label={`Play ${name}`}
				data-play-context={context}
				data-label-play={`Play ${name}`}
				data-label-pause={`Pause ${name}`}
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flex: "none",
						inlineSize: side,
						blockSize: side,
						padding: "0",
						border: "0",
						borderRadius: "999px",
						color: "var(--ui-brand-fg-on-solid, white)",
						backgroundColor: "var(--ui-brand-bg-solid)",
						boxShadow: "0 8px 20px -8px rgb(0 0 0 / 0.5)",
						cursor: "pointer",
						transition: "scale 140ms ease, background-color 140ms ease",
						"&:hover": { scale: "1.05", backgroundColor: "var(--ui-brand-bg-solid-hover)" },
						"&:active": { scale: "0.97" },
						"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" },
						"& [data-icon=pause]": { display: "none" },
						"@media (prefers-reduced-motion: reduce)": { transition: "none" },
					}),
					when(
						playing,
						raw({
							"& [data-icon=pause]": { display: "block" },
							"& [data-icon=play]": { display: "none" },
						}),
					),
				]}
			>
				<PlayIcon
					data-icon="play"
					size={size === "lg" ? 24 : 20}
					fill="currentColor"
					aria-hidden="true"
				/>
				<PauseIcon
					data-icon="pause"
					size={size === "lg" ? 24 : 20}
					fill="currentColor"
					aria-hidden="true"
				/>
			</button>
		);
	};
}

namespace ShuffleButton {
	export interface Props {
		name: string;
	}
}

/** The quiet button beside the play circle that starts the list shuffled. */
export function ShuffleButton(handle: Handle<ShuffleButton.Props>) {
	return () => (
		<button
			type="submit"
			aria-label={`Shuffle ${handle.props.name}`}
			title="Shuffle play"
			mix={[iconButton()]}
		>
			<ShuffleIcon size={24} aria-hidden="true" />
		</button>
	);
}

/** A round, quiet icon button sized for a thumb, used in headers and rows. */
export function iconButton() {
	return raw({
		display: "inline-grid",
		placeItems: "center",
		flex: "none",
		inlineSize: "var(--ui-target-size, 2.75rem)",
		blockSize: "var(--ui-target-size, 2.75rem)",
		padding: "0",
		border: "0",
		borderRadius: "999px",
		color: "var(--ui-neutral-fg-muted)",
		backgroundColor: "transparent",
		cursor: "pointer",
		textDecoration: "none",
		"&:hover": {
			color: "var(--ui-neutral-fg-emphasis)",
			backgroundColor: "var(--ui-neutral-bg-tint-hover)",
		},
		"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" },
		"&[aria-pressed=true]": { color: "var(--ui-brand-fg)" },
	});
}

namespace LikeForm {
	export interface Props {
		track: Track;
		liked: boolean;
		back: string;
	}
}

/**
 * A heart that adds a track to Liked Songs or takes it off, posting and coming back to the
 * same page; with script only the screen redraws, and a toast offers Undo.
 */
export function LikeForm(handle: Handle<LikeForm.Props>) {
	return () => {
		let { back, liked, track } = handle.props;
		return (
			<form
				method="post"
				action={actionHref(`like/${track.id}`)}
				data-murmur-library=""
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="on" value={liked ? "false" : "true"} />
				<input type="hidden" name="back" value={back} />
				<button
					type="submit"
					id={`murmur-like-${track.id}`}
					aria-pressed={liked}
					aria-label={
						liked ? `Remove ${track.title} from Liked Songs` : `Add ${track.title} to Liked Songs`
					}
					data-like=""
					mix={[
						iconButton(),
						raw({
							inlineSize: "2rem",
							blockSize: "2rem",
							"&[aria-pressed=false]": { opacity: "0" },
							":is(tr:hover, tr:focus-within) &": { opacity: "1" },
							"@media (hover: none)": { "&[aria-pressed=false]": { opacity: "1" } },
							"&[aria-pressed=true] svg": { fill: "currentColor" },
						}),
					]}
				>
					<HeartIcon size={16} aria-hidden="true" />
				</button>
			</form>
		);
	};
}

/** The artists of a track as links, joined with commas. */
export function ArtistLinks(handle: Handle<{ ids: readonly string[] }>) {
	return () => (
		<>
			{handle.props.ids.map((id, index) => (
				<>
					{index > 0 ? ", " : null}
					<a href={href(`artist/${id}`)}>{artistName(id)}</a>
				</>
			))}
		</>
	);
}

namespace Tracks {
	export interface Props {
		/** The list they play from. */
		context: string;
		tracks: readonly Track[];
		liked: readonly string[];
		back: string;
		/** Draws each row's cover, for a list mixing albums. */
		art?: boolean;
		album?: boolean;
		/** Days ago each track was added, in order, which shows the "Date added" column. */
		added?: readonly number[];
		/** The track the server knows is playing in this list. */
		current?: string;
		/** Leaves the table's heading row out, for a short list such as an artist's top five. */
		header?: boolean;
		/** Whether every row plays as a one-track list rather than as part of `context`. */
		single?: boolean;
	}
}

/**
 * A list of tracks as the track table: each row plays the list from that track, carries its
 * id for the player's playing mark, and ends with its heart.
 */
export function Tracks(handle: Handle<Tracks.Props>) {
	return () => {
		let {
			added,
			album,
			art,
			back,
			context,
			current,
			header = true,
			liked,
			single,
			tracks,
		} = handle.props;
		return (
			<div data-track-context={context}>
				<TrackList
					labels={TRACK_LABELS}
					columns={{ album, added: added !== undefined }}
					header={header}
				>
					{tracks.map((track, index) => {
						let source = findAlbum(track.album);
						let rowContext = single ? `track:${track.id}` : context;
						return (
							<TrackList.Row
								data-track-id={track.id}
								index={index + 1}
								title={track.title}
								artists={<ArtistLinks ids={track.artists} />}
								explicit={track.explicit}
								art={art && source !== undefined ? <Cover src={albumArt(source)} /> : undefined}
								album={
									album && source !== undefined ? (
										<a href={href(`album/${source.id}`)}>{source.title}</a>
									) : undefined
								}
								added={added === undefined ? undefined : addedLabel(added[index] ?? 0)}
								duration={track.duration}
								current={current === track.id}
								play={
									<PlayForm context={rowContext} track={track.id} back={back}>
										<TrackList.PlayButton
											aria-label={`Play ${track.title} by ${artistName(track.artists[0] ?? "")}`}
										/>
									</PlayForm>
								}
								trailing={<LikeForm track={track} liked={liked.includes(track.id)} back={back} />}
							/>
						);
					})}
				</TrackList>
			</div>
		);
	};
}

namespace Shelf {
	export interface Props {
		id: string;
		title: string;
		action?: RemixNode;
		children: RemixNode;
	}
}

/** A titled row of tiles that scrolls sideways, with paging buttons once script runs. */
export function Shelf(handle: Handle<Shelf.Props>) {
	return () => (
		<VideoShelf
			id={`murmur-${handle.props.id}`}
			title={handle.props.title}
			action={handle.props.action}
			labels={SHELF_LABELS}
			size="poster"
			mix={[raw({ "--ui-video-card-radius": "var(--ui-radius-md)" })]}
		>
			{handle.props.children}
		</VideoShelf>
	);
}

/** One tile on a shelf. */
export const ShelfItem = VideoShelf.Item;

namespace AlbumTile {
	export interface Props {
		album: Album;
		back: string;
		/** The second line; the year and kind when omitted. */
		subtitle?: string;
	}
}

/** An album as a tile that opens its page, with a play button over the art. */
export function AlbumTile(handle: Handle<AlbumTile.Props>) {
	return () => {
		let { album, back, subtitle } = handle.props;
		return (
			<MediaTile
				href={href(`album/${album.id}`)}
				title={album.title}
				subtitle={subtitle ?? `${album.year} · ${artistName(album.artist)}`}
				art={<Cover src={albumArt(album)} />}
				play={<TilePlay context={`album:${album.id}`} name={album.title} back={back} />}
			/>
		);
	};
}

namespace PlaylistTile {
	export interface Props {
		playlist: Playlist;
		back: string;
	}
}

/** A playlist as a tile, its description as the second line. */
export function PlaylistTile(handle: Handle<PlaylistTile.Props>) {
	return () => {
		let { back, playlist } = handle.props;
		return (
			<MediaTile
				href={href(`playlist/${playlist.id}`)}
				title={playlist.title}
				subtitle={playlist.mine ? `Playlist · ${playlist.owner}` : playlist.description}
				art={<Cover src={playlistArt(playlist)} />}
				play={<TilePlay context={`playlist:${playlist.id}`} name={playlist.title} back={back} />}
			/>
		);
	};
}

namespace ArtistTile {
	export interface Props {
		artist: Artist;
		back: string;
	}
}

/** An artist as a round tile. */
export function ArtistTile(handle: Handle<ArtistTile.Props>) {
	return () => {
		let { artist, back } = handle.props;
		return (
			<MediaTile
				shape="round"
				href={href(`artist/${artist.id}`)}
				title={artist.name}
				subtitle="Artist"
				art={<Cover src={artistArt(artist)} />}
				play={<TilePlay context={`artist:${artist.id}`} name={artist.name} back={back} />}
			/>
		);
	};
}

/** The play button over a tile's art. */
function TilePlay(handle: Handle<{ context: string; name: string; back: string }>) {
	return () => (
		<PlayForm context={handle.props.context} back={handle.props.back}>
			<PlayCircle context={handle.props.context} name={handle.props.name} size="md" />
		</PlayForm>
	);
}

/**
 * The page's side margins and the room above the player, on every screen. Headings inside it
 * that follow the ambient level, such as an empty state's title, sit under the screen's `h1`.
 */
export function Gutter(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<HeadingScope
			level={2}
			mix={[
				raw({
					display: "grid",
					gap: "2rem",
					paddingInline: "clamp(1rem, 3vw, 2rem)",
					paddingBlock: "1.5rem 3rem",
					minInlineSize: "0",
				}),
			]}
		>
			{handle.props.children}
		</HeadingScope>
	);
}

namespace CollectionHeader {
	export interface Props {
		kind: string;
		title: string;
		/** The cover, large. */
		art: RemixNode;
		/** The color the header's wash fades from, usually the cover's ground. */
		tint: string;
		/** A line of description under the title. */
		description?: RemixNode;
		/** The facts line: owner or artist, year, count and length. */
		meta: RemixNode;
		/** The play circle, shuffle and save buttons. */
		actions: RemixNode;
		/** Round art, for an artist. */
		round?: boolean;
	}
}

/**
 * The top of an album, playlist or artist page: a wash in the cover's color, the cover, the
 * kind, the name set large, the facts, and the action row beneath.
 */
export function CollectionHeader(handle: Handle<CollectionHeader.Props>) {
	return () => {
		let { actions, art, description, kind, meta, round, tint, title } = handle.props;
		return (
			<header
				mix={[
					raw({
						display: "grid",
						gap: "1.5rem",
						marginInline: "calc(-1 * clamp(1rem, 3vw, 2rem))",
						marginBlockStart: "-1.5rem",
						paddingInline: "clamp(1rem, 3vw, 2rem)",
						paddingBlock: "2rem 0",
						backgroundImage: `linear-gradient(to bottom, color-mix(in oklch, ${tint} 70%, transparent), color-mix(in oklch, ${tint} 22%, transparent) 70%, transparent)`,
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "flex-end",
							gap: "1.5rem",
						}),
					]}
				>
					<div
						mix={[
							raw({
								flex: "none",
								inlineSize: "clamp(9rem, 28vw, 14.5rem)",
								aspectRatio: "1",
								overflow: "clip",
								borderRadius: round ? "50%" : "var(--ui-radius-md)",
								boxShadow: "0 18px 50px -18px rgb(0 0 0 / 0.6)",
								"& > img": { display: "block", inlineSize: "100%", blockSize: "100%" },
							}),
						]}
					>
						{art}
					</div>
					<div
						mix={[
							raw({ display: "grid", gap: "0.5rem", minInlineSize: "min(100%, 18rem)", flex: "1" }),
						]}
					>
						<span
							mix={[
								raw({
									fontSize: "0.8125rem",
									fontWeight: "700",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{kind}
						</span>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "clamp(2rem, 6vw, 4.5rem)",
									lineHeight: "1",
									fontWeight: "850",
									letterSpacing: "-0.035em",
									color: "var(--ui-neutral-fg-emphasis)",
									textWrap: "balance",
									overflowWrap: "anywhere",
								}),
							]}
						>
							{title}
						</h1>
						{description === undefined ? null : (
							<p
								mix={[
									raw({
										margin: "0",
										fontSize: "0.9375rem",
										color: "var(--ui-neutral-fg-muted)",
										maxInlineSize: "60ch",
									}),
								]}
							>
								{description}
							</p>
						)}
						<p
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.375rem",
									margin: "0",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg)",
									"& a": {
										fontWeight: "700",
										color: "var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
									},
									"& a:hover": { textDecoration: "underline" },
								}),
							]}
						>
							{meta}
						</p>
					</div>
				</div>
				<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>{actions}</div>
			</header>
		);
	};
}

/** A middle dot between facts, read as nothing. */
export function Dot() {
	return () => (
		<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
			·
		</span>
	);
}

/** A small round artist picture beside their name in a facts line. */
export function ArtistChip(handle: Handle<{ id: string }>) {
	return () => {
		let artist = findArtist(handle.props.id);
		if (artist === undefined) return null;
		return (
			<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
				<img
					src={artistArt(artist)}
					alt=""
					width="24"
					height="24"
					mix={[raw({ inlineSize: "1.5rem", blockSize: "1.5rem", borderRadius: "999px" })]}
				/>
				<a href={href(`artist/${artist.id}`)}>{artist.name}</a>
			</span>
		);
	};
}

namespace SectionTitle {
	export interface Props {
		children: RemixNode;
		action?: RemixNode;
	}
}

/** A section's heading on a screen, with an optional link at its end. */
export function SectionTitle(handle: Handle<SectionTitle.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
					gap: "1rem",
				}),
			]}
		>
			<h2
				mix={[
					raw({
						margin: "0",
						fontSize: "1.375rem",
						lineHeight: "1.2",
						fontWeight: "800",
						letterSpacing: "-0.02em",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{handle.props.children}
			</h2>
			{handle.props.action}
		</div>
	);
}
