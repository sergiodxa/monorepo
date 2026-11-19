/**
 * An artist's page: a banner in their hue with the name set large and this month's listeners,
 * play and follow, their five most played tracks, the discography, related artists and a
 * short about card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { Artist } from "./data";
import type { Listener } from "./state";

import { artistArt } from "./art";
import { actionHref, albumsBy, findArtist, formatCount, popularTracks } from "./data";
import {
	AlbumTile,
	ArtistTile,
	Gutter,
	PlayCircle,
	PlayForm,
	SectionTitle,
	Shelf,
	ShelfItem,
	Tracks,
} from "./parts";

namespace ArtistPage {
	export interface Props {
		artist: Artist;
		listener: Listener;
		back: string;
	}
}

/** Renders the artist's page. */
export default function ArtistPage(handle: Handle<ArtistPage.Props>) {
	return () => {
		let { artist, back, listener } = handle.props;
		let context = `artist:${artist.id}`;
		let following = listener.followed.includes(artist.id);
		let releases = albumsBy(artist.id);
		let related = artist.related.map(findArtist).filter((entry) => entry !== undefined);
		return (
			<Gutter>
				<header
					mix={[
						raw({
							position: "relative",
							display: "grid",
							alignContent: "end",
							gap: "0.5rem",
							minBlockSize: "clamp(14rem, 34vw, 20rem)",
							marginInline: "calc(-1 * clamp(1rem, 3vw, 2rem))",
							marginBlockStart: "-1.5rem",
							paddingInline: "clamp(1rem, 3vw, 2rem)",
							paddingBlock: "1.5rem",
							overflow: "clip",
							color: "white",
							"& > img": {
								position: "absolute",
								inset: "0",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
								objectPosition: "center 40%",
								zIndex: "0",
							},
							"&::after": {
								content: "''",
								position: "absolute",
								inset: "0",
								background: "linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0.1) 60%)",
								zIndex: "0",
							},
							"& > :not(img)": { position: "relative", zIndex: "1" },
						}),
					]}
				>
					<img src={artistArt(artist)} alt="" width="600" height="600" />
					<span mix={[raw({ fontSize: "0.8125rem", fontWeight: "700" })]}>Artist</span>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(2.5rem, 8vw, 6rem)",
								lineHeight: "0.95",
								fontWeight: "850",
								letterSpacing: "-0.04em",
								textWrap: "balance",
							}),
						]}
					>
						{artist.name}
					</h1>
					<p mix={[raw({ margin: "0", fontSize: "0.9375rem" })]}>
						{formatCount(artist.listeners)} monthly listeners
					</p>
				</header>
				<div mix={[raw({ display: "flex", alignItems: "center", gap: "1rem" })]}>
					<PlayForm context={context} back={back}>
						<PlayCircle context={context} name={artist.name} />
					</PlayForm>
					<form
						method="post"
						action={actionHref(`follow/${artist.id}`)}
						data-murmur-library=""
						mix={[raw({ display: "contents" })]}
					>
						<input type="hidden" name="on" value={following ? "false" : "true"} />
						<input type="hidden" name="back" value={back} />
						<button
							type="submit"
							id={`murmur-follow-${artist.id}`}
							aria-pressed={following}
							mix={[
								raw({
									minBlockSize: "2.25rem",
									paddingInline: "1rem",
									border: "1px solid var(--ui-neutral-border-strong, var(--ui-neutral-border))",
									borderRadius: "999px",
									font: "inherit",
									fontSize: "0.875rem",
									fontWeight: "700",
									color: "var(--ui-neutral-fg-emphasis)",
									backgroundColor: "transparent",
									cursor: "pointer",
									"&:hover": { borderColor: "var(--ui-neutral-fg-emphasis)", scale: "1.03" },
									"&:focus-visible": {
										outline: "2px solid var(--ui-brand-ring)",
										outlineOffset: "2px",
									},
								}),
							]}
						>
							{following ? "Following" : "Follow"}
						</button>
					</form>
				</div>
				<section mix={[raw({ display: "grid", gap: "0.75rem" })]}>
					<SectionTitle>Popular</SectionTitle>
					<Tracks
						context={context}
						tracks={popularTracks(artist.id)}
						liked={listener.liked}
						back={back}
						art
						header={false}
						current={listener.now?.context === context ? listener.now.track : undefined}
					/>
				</section>
				<Shelf id={`discography-${artist.id}`} title="Discography">
					{releases.map((entry) => (
						<ShelfItem>
							<AlbumTile album={entry} back={back} subtitle={`${entry.year} · ${entry.kind}`} />
						</ShelfItem>
					))}
				</Shelf>
				<Shelf id={`related-${artist.id}`} title="Fans also like">
					{related.map((entry) => (
						<ShelfItem>
							<ArtistTile artist={entry} back={back} />
						</ShelfItem>
					))}
				</Shelf>
				<section
					aria-labelledby={`about-${artist.id}`}
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							maxInlineSize: "42rem",
							padding: "1.5rem",
							borderRadius: "var(--ui-radius-lg)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
						}),
					]}
				>
					<h2
						id={`about-${artist.id}`}
						mix={[
							raw({
								margin: "0",
								fontSize: "1.125rem",
								fontWeight: "800",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						About
					</h2>
					<p mix={[raw({ margin: "0", fontSize: "1rem", lineHeight: "1.6" })]}>{artist.bio}</p>
					<p
						mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{formatCount(artist.listeners)} monthly listeners · {releases.length}{" "}
						{releases.length === 1 ? "release" : "releases"}
					</p>
				</section>
			</Gutter>
		);
	};
}
