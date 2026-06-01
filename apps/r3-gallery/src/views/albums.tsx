import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { Album } from "../data/types";

import { Shell } from "../components/shell";
import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for the album list page.
 */
export interface AlbumsPageProps {
	albums: Album[];
}

/**
 * Renders the album index as large tappable cards.
 *
 * @param handle Component handle carrying fetched albums.
 * @returns Album index route UI.
 */
export function AlbumsPage(handle: Handle<AlbumsPageProps>) {
	return () => (
		<Shell
			eyebrow="JSONPlaceholder albums"
			title="Browse quiet little albums"
			intro="A client-only Remix UI router demo. Pick an album to load its photos without a server render."
		>
			<ul
				mix={css({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
					gap: "1rem",
					margin: 0,
					padding: 0,
					listStyle: "none",
				})}
				aria-label="Albums"
			>
				{handle.props.albums.map((album) => (
					<li key={album.id}>
						<a
							mix={css({
								display: "grid",
								boxSizing: "border-box",
								minHeight: "13rem",
								padding: "1.2rem",
								border: "1px solid rgb(154 52 18 / 0.16)",
								borderRadius: "1.5rem",
								background: "rgb(255 255 255 / 0.65)",
								boxShadow: "0 1.5rem 4rem rgb(124 45 18 / 0.08)",
								color: "inherit",
								textDecoration: "none",
								transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
								WebkitTapHighlightColor: "transparent",
								"&:hover": {
									background: "#ffffff",
									boxShadow: "0 2rem 5rem rgb(124 45 18 / 0.14)",
									transform: "translateY(-0.25rem)",
								},
								"&:focus-visible": {
									outline: "3px solid #f97316",
									outlineOffset: "4px",
								},
								"@media (prefers-reduced-motion: reduce)": {
									transitionDuration: "0.01ms",
								},
							})}
							href={routes.album.href({ id: String(album.id) })}
						>
							<span
								mix={css({
									alignSelf: "start",
									color: "#c2410c",
									fontSize: "0.82rem",
									fontWeight: 800,
									letterSpacing: "0.12em",
									textTransform: "uppercase",
								})}
							>
								Album {album.id}
							</span>
							<h2
								mix={css({
									alignSelf: "end",
									margin: 0,
									fontFamily: 'Georgia, "Times New Roman", serif',
									fontSize: "1.8rem",
									fontWeight: 500,
									letterSpacing: "-0.04em",
									lineHeight: 1,
								})}
							>
								{titleCase(album.title)}
							</h2>
						</a>
					</li>
				))}
			</ul>
		</Shell>
	);
}
