/**
 * The pages that list tracks to play in order: an album with its release line, a playlist
 * with when each track was added, and the listener's Liked Songs. Each opens with the
 * collection header and its play, shuffle and save buttons over the track table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon, HeartIcon, PlusIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { formatTotalTime } from "@sdxc/ui/audio";

import type { Album, Playlist, Track } from "./data";
import type { Listener } from "./state";

import { LIKED_ART, albumArt, playlistArt } from "./art";
import {
	LISTENER,
	actionHref,
	albumsBy,
	artistName,
	findTrack,
	formatCount,
	href,
	playlistTracks,
} from "./data";
import {
	AlbumTile,
	ArtistChip,
	CollectionHeader,
	Cover,
	Dot,
	Gutter,
	PlayCircle,
	PlayForm,
	Shelf,
	ShelfItem,
	ShuffleButton,
	Tracks,
	iconButton,
} from "./parts";

/** The units a collection's total length is written in. */
const UNITS = { hour: "hr", minute: "min" };

/** The count and total length of a list, such as "7 songs, 24 min". */
function lengthLine(tracks: readonly Track[]): string {
	let total = tracks.reduce((sum, track) => sum + track.duration, 0);
	return `${tracks.length} ${tracks.length === 1 ? "song" : "songs"}, ${formatTotalTime(total, UNITS)}`;
}

namespace SaveButton {
	export interface Props {
		/** The library key, such as `album:tidelight`. */
		item: string;
		name: string;
		saved: boolean;
		back: string;
	}
}

/** Saves an album or playlist to the library, or takes it out; a toast offers Undo. */
export function SaveButton(handle: Handle<SaveButton.Props>) {
	return () => {
		let { back, item, name, saved } = handle.props;
		return (
			<form
				method="post"
				action={actionHref("save")}
				data-murmur-library=""
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="item" value={item} />
				<input type="hidden" name="on" value={saved ? "false" : "true"} />
				<input type="hidden" name="back" value={back} />
				<button
					type="submit"
					id={`murmur-save-${item.replace(":", "-")}`}
					aria-pressed={saved}
					aria-label={saved ? `Remove ${name} from Your Library` : `Save ${name} to Your Library`}
					title={saved ? "Remove from Your Library" : "Save to Your Library"}
					mix={[
						iconButton(),
						raw({
							"& > span": {
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "1.75rem",
								blockSize: "1.75rem",
								borderRadius: "999px",
								border: "2px solid currentColor",
							},
							"&[aria-pressed=true] > span": {
								border: "0",
								color: "var(--ui-brand-fg-on-solid, white)",
								backgroundColor: "var(--ui-brand-bg-solid)",
							},
						}),
					]}
				>
					<span>
						{saved ? (
							<CheckIcon size={16} strokeWidth={3} aria-hidden="true" />
						) : (
							<PlusIcon size={16} strokeWidth={3} aria-hidden="true" />
						)}
					</span>
				</button>
			</form>
		);
	};
}

namespace AlbumPage {
	export interface Props {
		album: Album;
		listener: Listener;
		back: string;
	}
}

/** An album: its header, its tracks, the release line and more by the same artist. */
export function AlbumPage(handle: Handle<AlbumPage.Props>) {
	return () => {
		let { album, back, listener } = handle.props;
		let context = `album:${album.id}`;
		let saved = listener.saved.includes(context);
		let more = albumsBy(album.artist).filter((entry) => entry.id !== album.id);
		return (
			<Gutter>
				<CollectionHeader
					kind={album.kind}
					title={album.title}
					tint={album.palette.ground}
					art={<Cover src={albumArt(album)} eager />}
					meta={
						<>
							<ArtistChip id={album.artist} />
							<Dot />
							<span>{album.year}</span>
							<Dot />
							<span>{lengthLine(album.tracks)}</span>
						</>
					}
					actions={
						<>
							<PlayForm context={context} back={back}>
								<PlayCircle context={context} name={album.title} />
							</PlayForm>
							<PlayForm context={context} shuffle back={back}>
								<ShuffleButton name={album.title} />
							</PlayForm>
							<SaveButton item={context} name={album.title} saved={saved} back={back} />
						</>
					}
				/>
				<Tracks
					context={context}
					tracks={album.tracks}
					liked={listener.liked}
					back={back}
					current={listener.now?.context === context ? listener.now.track : undefined}
				/>
				<p
					mix={[
						raw({
							margin: "0",
							display: "grid",
							gap: "0.125rem",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg)" })]}>
						{album.released}
					</span>
					<span>
						© {album.year} {album.label}. Every note on this record is synthesized in your browser.
					</span>
				</p>
				{more.length === 0 ? null : (
					<Shelf
						id={`more-${album.artist}`}
						title={`More by ${artistName(album.artist)}`}
						action={
							<a href={href(`artist/${album.artist}`)} mix={[seeAll()]}>
								Show discography
							</a>
						}
					>
						{more.map((entry) => (
							<ShelfItem>
								<AlbumTile album={entry} back={back} subtitle={`${entry.year} · ${entry.kind}`} />
							</ShelfItem>
						))}
					</Shelf>
				)}
			</Gutter>
		);
	};
}

/** The quiet link at a shelf's end. */
export function seeAll() {
	return raw({
		fontSize: "0.8125rem",
		fontWeight: "700",
		color: "var(--ui-neutral-fg-muted)",
		textDecoration: "none",
		"&:hover": { color: "var(--ui-neutral-fg-emphasis)", textDecoration: "underline" },
	});
}

namespace PlaylistPage {
	export interface Props {
		playlist: Playlist;
		listener: Listener;
		back: string;
	}
}

/** A playlist: its header with the owner and saves, and its tracks with when each was added. */
export function PlaylistPage(handle: Handle<PlaylistPage.Props>) {
	return () => {
		let { back, listener, playlist } = handle.props;
		let context = `playlist:${playlist.id}`;
		let tracks = playlistTracks(playlist);
		let saved = listener.saved.includes(context);
		return (
			<Gutter>
				<CollectionHeader
					kind={playlist.mine ? "Your playlist" : "Playlist"}
					title={playlist.title}
					tint={playlist.palette.ground}
					art={<Cover src={playlistArt(playlist)} eager />}
					description={playlist.description}
					meta={
						<>
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{playlist.owner}
							</strong>
							<Dot />
							<span>
								{formatCount(playlist.saves)} {playlist.saves === 1 ? "save" : "saves"}
							</span>
							<Dot />
							<span>{lengthLine(tracks)}</span>
						</>
					}
					actions={
						<>
							<PlayForm context={context} back={back}>
								<PlayCircle context={context} name={playlist.title} />
							</PlayForm>
							<PlayForm context={context} shuffle back={back}>
								<ShuffleButton name={playlist.title} />
							</PlayForm>
							{playlist.mine ? null : (
								<SaveButton item={context} name={playlist.title} saved={saved} back={back} />
							)}
						</>
					}
				/>
				<Tracks
					context={context}
					tracks={tracks}
					liked={listener.liked}
					back={back}
					art
					album
					added={playlist.added}
					current={listener.now?.context === context ? listener.now.track : undefined}
				/>
			</Gutter>
		);
	};
}

namespace LikedPage {
	export interface Props {
		listener: Listener;
		back: string;
	}
}

/** The listener's Liked Songs, newest first, or a first-run state when they have none. */
export function LikedPage(handle: Handle<LikedPage.Props>) {
	return () => {
		let { back, listener } = handle.props;
		let tracks = listener.liked.map(findTrack).filter((track) => track !== undefined);
		return (
			<Gutter>
				<CollectionHeader
					kind="Playlist"
					title="Liked Songs"
					tint="oklch(0.5 0.2 262)"
					art={<Cover src={LIKED_ART} eager />}
					meta={
						<>
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{LISTENER.name}
							</strong>
							<Dot />
							<span>{lengthLine(tracks)}</span>
						</>
					}
					actions={
						tracks.length === 0 ? null : (
							<>
								<PlayForm context="liked" back={back}>
									<PlayCircle context="liked" name="Liked Songs" />
								</PlayForm>
								<PlayForm context="liked" shuffle back={back}>
									<ShuffleButton name="Liked Songs" />
								</PlayForm>
							</>
						)
					}
				/>
				{tracks.length === 0 ? (
					<Empty kind="first-run" icon={<HeartIcon />}>
						<Empty.Title>Songs you like will appear here</Empty.Title>
						<Empty.Description>Press the heart on any track to save it here.</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("search")}>Find songs</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<Tracks
						context="liked"
						tracks={tracks}
						liked={listener.liked}
						back={back}
						art
						album
						current={listener.now?.context === "liked" ? listener.now.track : undefined}
					/>
				)}
			</Gutter>
		);
	};
}
