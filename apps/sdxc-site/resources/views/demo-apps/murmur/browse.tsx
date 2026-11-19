/**
 * The screens for finding music: search with its genre tiles and results, a genre's page, and
 * the listener's library filtered by kind in the address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { SearchIcon, SearchXIcon, XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Empty } from "@sdxc/ui/app/empty";
import { MediaTile } from "@sdxc/ui/audio/media-tile";

import type { Genre } from "./data";
import type { Listener } from "./state";

import { LIKED_ART, artistArt, genreArt, playlistArt } from "./art";
import {
	ALBUMS,
	ARTISTS,
	GENRES,
	PLAYLISTS,
	findAlbum,
	findArtist,
	findPlaylist,
	href,
	searchCatalogue,
	artistName,
} from "./data";
import {
	AlbumTile,
	ArtistTile,
	Cover,
	Gutter,
	PlayCircle,
	PlayForm,
	PlaylistTile,
	SectionTitle,
	Shelf,
	ShelfItem,
	Tracks,
} from "./parts";

/** A page title at the top of a browse screen. */
function PageTitle(handle: Handle<{ children: RemixNode }>) {
	return () => (
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
			{handle.props.children}
		</h1>
	);
}

namespace SearchPage {
	export interface Props {
		query: string;
		listener: Listener;
		back: string;
	}
}

/**
 * Search: the field, then the genre tiles until something is typed, then what matched. The
 * field is an ordinary GET form, so a search is an address that can be shared and reloaded.
 */
export function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { back, listener, query } = handle.props;
		let trimmed = query.trim();
		return (
			<Gutter>
				<PageTitle>Search</PageTitle>
				<form
					method="get"
					action={href("search")}
					role="search"
					mix={[
						raw({ position: "relative", maxInlineSize: "32rem", marginBlockStart: "-0.75rem" }),
					]}
				>
					<SearchIcon
						size={20}
						aria-hidden="true"
						mix={[
							raw({
								position: "absolute",
								insetInlineStart: "0.875rem",
								insetBlockStart: "calc(50% - 10px)",
								color: "var(--ui-neutral-fg-muted)",
								pointerEvents: "none",
							}),
						]}
					/>
					<input
						id="murmur-search"
						type="search"
						aria-label="What do you want to listen to?"
						name="q"
						value={query}
						placeholder="Artists, songs or playlists"
						autocomplete="off"
						enterkeyhint="search"
						mix={[
							raw({
								boxSizing: "border-box",
								inlineSize: "100%",
								blockSize: "3rem",
								paddingInline: "2.75rem 2.75rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "999px",
								font: "inherit",
								fontSize: "1rem",
								color: "var(--ui-neutral-fg-emphasis)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								"&:hover": {
									borderColor: "var(--ui-neutral-border-hover, var(--ui-neutral-fg-muted))",
								},
								"&:focus": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" },
								"&::-webkit-search-cancel-button": { appearance: "none" },
							}),
						]}
					/>
					{trimmed === "" ? null : (
						<a
							href={href("search")}
							aria-label="Clear search"
							mix={[
								raw({
									position: "absolute",
									insetInlineEnd: "0.375rem",
									insetBlockStart: "0.25rem",
									display: "inline-grid",
									placeItems: "center",
									inlineSize: "2.5rem",
									blockSize: "2.5rem",
									borderRadius: "999px",
									color: "var(--ui-neutral-fg-muted)",
									"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
								}),
							]}
						>
							<XIcon size={18} aria-hidden="true" />
						</a>
					)}
				</form>
				{trimmed === "" ? (
					<GenreTiles />
				) : (
					<Results query={trimmed} listener={listener} back={back} />
				)}
			</Gutter>
		);
	};
}

/** Every genre as a colored tile with its art tilted in the corner. */
function GenreTiles() {
	return () => (
		<section mix={[raw({ display: "grid", gap: "1rem" })]}>
			<SectionTitle>Browse all</SectionTitle>
			<ul
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 11rem), 1fr))",
						gap: "1rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
						"@media (max-width: 40rem)": {
							gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							gap: "0.75rem",
						},
					}),
				]}
			>
				{GENRES.map((genre) => (
					<li>
						<GenreTile genre={genre} />
					</li>
				))}
			</ul>
		</section>
	);
}

/** One genre tile. */
function GenreTile(handle: Handle<{ genre: Genre }>) {
	return () => {
		let { genre } = handle.props;
		return (
			<a
				href={href(`genre/${genre.id}`)}
				mix={[
					raw({
						position: "relative",
						display: "block",
						aspectRatio: "16 / 10",
						overflow: "clip",
						padding: "0.875rem 1rem",
						borderRadius: "var(--ui-radius-md)",
						color: "white",
						fontSize: "1.25rem",
						fontWeight: "800",
						letterSpacing: "-0.02em",
						textDecoration: "none",
						textShadow: "0 1px 8px rgb(0 0 0 / 0.25)",
						"& > img": {
							position: "absolute",
							insetInlineEnd: "-12%",
							insetBlockEnd: "-8%",
							inlineSize: "52%",
							blockSize: "auto",
							aspectRatio: "1",
							rotate: "22deg",
							borderRadius: "var(--ui-radius-sm)",
							boxShadow: "0 6px 18px rgb(0 0 0 / 0.3)",
							transition: "rotate 200ms ease, scale 200ms ease",
						},
						"&:hover > img": { rotate: "16deg", scale: "1.05" },
						"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" },
						"@media (prefers-reduced-motion: reduce)": { "& > img": { transition: "none" } },
					}),
				]}
				style={{ backgroundColor: genre.color }}
			>
				<span mix={[raw({ position: "relative", zIndex: "1" })]}>{genre.name}</span>
				<img
					src={genreArt(genre)}
					alt=""
					width="300"
					height="300"
					loading="lazy"
					decoding="async"
				/>
			</a>
		);
	};
}

/** What a search matched: the top result, songs, then shelves of artists, albums and playlists. */
function Results(handle: Handle<{ query: string; listener: Listener; back: string }>) {
	return () => {
		let { back, listener, query } = handle.props;
		let found = searchCatalogue(query);
		let total =
			found.tracks.length + found.albums.length + found.artists.length + found.playlists.length;
		if (total === 0) {
			return (
				<Empty kind="no-results" icon={<SearchXIcon />}>
					<Empty.Title>No results for “{query}”</Empty.Title>
					<Empty.Description>
						Check the spelling, or try a genre like “ambient” or “house”.
					</Empty.Description>
				</Empty>
			);
		}
		let top = found.artists[0];
		return (
			<>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
							gap: "1.5rem",
							"@media (max-width: 56rem)": { gridTemplateColumns: "minmax(0, 1fr)" },
						}),
					]}
				>
					{top === undefined ? null : (
						<section mix={[raw({ display: "grid", gap: "0.75rem", alignContent: "start" })]}>
							<SectionTitle>Top result</SectionTitle>
							<div
								mix={[
									raw({
										position: "relative",
										display: "grid",
										gap: "1rem",
										padding: "1.25rem",
										borderRadius: "var(--ui-radius-lg)",
										backgroundColor: "var(--ui-neutral-bg-tint)",
										"&:hover, &:focus-within": {
											backgroundColor: "var(--ui-neutral-bg-tint-hover)",
										},
										"& [data-top-play]": {
											position: "absolute",
											insetInlineEnd: "1.25rem",
											insetBlockEnd: "1.25rem",
										},
									}),
								]}
							>
								<img
									src={artistArt(top)}
									alt=""
									width="96"
									height="96"
									mix={[
										raw({
											inlineSize: "6rem",
											blockSize: "6rem",
											borderRadius: "999px",
											boxShadow: "0 8px 24px -10px rgb(0 0 0 / 0.5)",
										}),
									]}
								/>
								<a
									href={href(`artist/${top.id}`)}
									mix={[
										raw({
											fontSize: "2rem",
											fontWeight: "850",
											letterSpacing: "-0.03em",
											color: "var(--ui-neutral-fg-emphasis)",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
										}),
									]}
								>
									{top.name}
								</a>
								<span
									mix={[
										raw({
											justifySelf: "start",
											paddingInline: "0.625rem",
											paddingBlock: "0.125rem",
											borderRadius: "999px",
											fontSize: "0.75rem",
											fontWeight: "700",
											backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
										}),
									]}
								>
									Artist
								</span>
								<span data-top-play="">
									<PlayForm context={`artist:${top.id}`} back={back}>
										<PlayCircle context={`artist:${top.id}`} name={top.name} size="md" />
									</PlayForm>
								</span>
							</div>
						</section>
					)}
					{found.tracks.length === 0 ? null : (
						<section mix={[raw({ display: "grid", gap: "0.75rem", alignContent: "start" })]}>
							<SectionTitle>Songs</SectionTitle>
							<Tracks
								context={`search:${query}`}
								single
								tracks={found.tracks.slice(0, 4)}
								liked={listener.liked}
								back={back}
								art
								header={false}
							/>
						</section>
					)}
				</div>
				{found.artists.length === 0 ? null : (
					<Shelf id="search-artists" title="Artists">
						{found.artists.map((artist) => (
							<ShelfItem>
								<ArtistTile artist={artist} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
				{found.albums.length === 0 ? null : (
					<Shelf id="search-albums" title="Albums">
						{found.albums.map((entry) => (
							<ShelfItem>
								<AlbumTile album={entry} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
				{found.playlists.length === 0 ? null : (
					<Shelf id="search-playlists" title="Playlists">
						{found.playlists.map((playlist) => (
							<ShelfItem>
								<PlaylistTile playlist={playlist} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
			</>
		);
	};
}

namespace GenrePage {
	export interface Props {
		genre: Genre;
		back: string;
	}
}

/** A genre: a colored band with its name, then its playlists, albums and artists. */
export function GenrePage(handle: Handle<GenrePage.Props>) {
	return () => {
		let { back, genre } = handle.props;
		let playlists = PLAYLISTS.filter(
			(playlist) => !playlist.mine && playlist.genres.includes(genre.id),
		);
		let albums = ALBUMS.filter((entry) => entry.genres.includes(genre.id));
		let artists = ARTISTS.filter((artist) => artist.genres.includes(genre.id));
		return (
			<Gutter>
				<header
					mix={[
						raw({
							display: "grid",
							alignContent: "end",
							minBlockSize: "clamp(9rem, 22vw, 13rem)",
							marginInline: "calc(-1 * clamp(1rem, 3vw, 2rem))",
							marginBlockStart: "-1.5rem",
							paddingInline: "clamp(1rem, 3vw, 2rem)",
							paddingBlock: "1.5rem",
							color: "white",
						}),
					]}
					style={{
						backgroundImage: `linear-gradient(to bottom, ${genre.color}, color-mix(in oklch, ${genre.color} 55%, transparent))`,
					}}
				>
					<span mix={[raw({ fontSize: "0.8125rem", fontWeight: "700" })]}>Genre</span>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(2.5rem, 7vw, 5rem)",
								fontWeight: "850",
								letterSpacing: "-0.04em",
								lineHeight: "1",
							}),
						]}
					>
						{genre.name}
					</h1>
				</header>
				{playlists.length === 0 ? null : (
					<Shelf id={`genre-playlists-${genre.id}`} title={`${genre.name} playlists`}>
						{playlists.map((playlist) => (
							<ShelfItem>
								<PlaylistTile playlist={playlist} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
				{albums.length === 0 ? null : (
					<Shelf id={`genre-albums-${genre.id}`} title="Albums">
						{albums.map((entry) => (
							<ShelfItem>
								<AlbumTile album={entry} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
				{artists.length === 0 ? null : (
					<Shelf id={`genre-artists-${genre.id}`} title="Artists">
						{artists.map((artist) => (
							<ShelfItem>
								<ArtistTile artist={artist} back={back} />
							</ShelfItem>
						))}
					</Shelf>
				)}
			</Gutter>
		);
	};
}

/** The kinds the library filters by, in chip order. */
export const LIBRARY_VIEWS = [
	{ id: "all", label: "All" },
	{ id: "playlists", label: "Playlists" },
	{ id: "albums", label: "Albums" },
	{ id: "artists", label: "Artists" },
] as const;

/** A library filter. */
export type LibraryView = (typeof LIBRARY_VIEWS)[number]["id"];

/**
 * Reads the library filter from the address, `all` for anything else.
 *
 * @param value The `view` parameter.
 */
export function libraryView(value: string | null): LibraryView {
	return LIBRARY_VIEWS.find((view) => view.id === value)?.id ?? "all";
}

namespace LibraryPage {
	export interface Props {
		listener: Listener;
		view: LibraryView;
		back: string;
	}
}

/**
 * The listener's library: chips that filter by kind, kept in the address, over a grid of
 * Liked Songs, their playlists, what they saved and who they follow.
 */
export function LibraryPage(handle: Handle<LibraryPage.Props>) {
	return () => {
		let { back, listener, view } = handle.props;
		let mine = PLAYLISTS.filter((playlist) => playlist.mine);
		let saved = listener.saved;
		let tiles: RemixNode[] = [];
		if (view === "all" || view === "playlists") {
			tiles.push(
				<MediaTile
					href={href("liked")}
					title="Liked Songs"
					subtitle={`Playlist · ${listener.liked.length} songs`}
					art={<Cover src={LIKED_ART} />}
					play={
						listener.liked.length === 0 ? undefined : (
							<PlayForm context="liked" back={back}>
								<PlayCircle context="liked" name="Liked Songs" size="md" />
							</PlayForm>
						)
					}
				/>,
				...mine.map((playlist) => <PlaylistTile playlist={playlist} back={back} />),
			);
		}
		for (let key of saved) {
			let [kind, id = ""] = key.split(":");
			if (kind === "playlist" && (view === "all" || view === "playlists")) {
				let playlist = findPlaylist(id);
				if (playlist !== undefined) {
					tiles.push(
						<MediaTile
							href={href(`playlist/${id}`)}
							title={playlist.title}
							subtitle={`Playlist · ${playlist.owner}`}
							art={<Cover src={playlistArt(playlist)} />}
						/>,
					);
				}
			}
			if (kind === "album" && (view === "all" || view === "albums")) {
				let entry = findAlbum(id);
				if (entry !== undefined) {
					tiles.push(
						<AlbumTile
							album={entry}
							back={back}
							subtitle={`Album · ${artistName(entry.artist)}`}
						/>,
					);
				}
			}
		}
		if (view === "all" || view === "artists") {
			for (let id of listener.followed) {
				let artist = findArtist(id);
				if (artist !== undefined) tiles.push(<ArtistTile artist={artist} back={back} />);
			}
		}
		return (
			<Gutter>
				<PageTitle>Your Library</PageTitle>
				<nav aria-label="Filter your library" mix={[raw({ marginBlockStart: "-0.75rem" })]}>
					<ul
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.5rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						{LIBRARY_VIEWS.map((entry) => (
							<li>
								<a
									href={entry.id === "all" ? href("library") : href(`library?view=${entry.id}`)}
									aria-current={entry.id === view ? "page" : undefined}
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											minBlockSize: "2rem",
											paddingInline: "0.875rem",
											borderRadius: "999px",
											fontSize: "0.875rem",
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
											textDecoration: "none",
											backgroundColor: "var(--ui-neutral-bg-tint)",
											"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
											"&[aria-current=page]": {
												color: "var(--ui-brand-fg-on-solid, white)",
												backgroundColor: "var(--ui-brand-bg-solid)",
											},
											"&:focus-visible": {
												outline: "2px solid var(--ui-brand-ring)",
												outlineOffset: "2px",
											},
											"@media (pointer: coarse)": { minBlockSize: "2.5rem" },
										}),
									]}
								>
									{entry.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
				{tiles.length === 0 ? (
					<Empty kind="first-run" icon={<SearchIcon />}>
						<Empty.Title>Nothing here yet</Empty.Title>
						<Empty.Description>
							Save albums and playlists, or follow artists, and they gather here.
						</Empty.Description>
					</Empty>
				) : (
					<ul
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 10rem), 1fr))",
								gap: "1.5rem 1rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
								"@media (max-width: 40rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
							}),
						]}
					>
						{tiles.map((tile) => (
							<li>{tile}</li>
						))}
					</ul>
				)}
			</Gutter>
		);
	};
}
