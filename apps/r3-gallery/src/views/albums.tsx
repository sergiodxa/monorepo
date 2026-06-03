import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";
import { css, on } from "remix/ui";

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
	let router = handle.context.get(RouterProvider);

	return () => (
		<Shell
			eyebrow="JSONPlaceholder albums"
			title="Browse quiet little albums"
			intro="A client-only Remix UI router demo. Pick an album to load its photos without a server render."
		>
			<section
				mix={css({
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) auto",
					gap: "0.75rem",
					marginBlockEnd: "1.5rem",
					padding: "1rem",
					border: "1px solid rgb(154 52 18 / 0.14)",
					borderRadius: "1.5rem",
					background: "rgb(255 255 255 / 0.62)",
					"@media (max-width: 680px)": {
						gridTemplateColumns: "1fr",
					},
				})}
				aria-label="Album shortcuts"
			>
				<form
					method="POST"
					action={routes.openAlbum.href()}
					mix={[
						router.form(),
						css({
							display: "flex",
							alignItems: "end",
							gap: "0.75rem",
							"@media (max-width: 520px)": {
								alignItems: "stretch",
								flexDirection: "column",
							},
						}),
					]}
				>
					<label
						mix={css({
							display: "grid",
							gap: "0.35rem",
							color: "#7c2d12",
							fontSize: "0.82rem",
							fontWeight: 800,
						})}
					>
						Jump to album
						<input
							name="albumId"
							type="number"
							min="1"
							max="100"
							placeholder="1"
							mix={css({
								boxSizing: "border-box",
								width: "9rem",
								padding: "0.7rem 0.85rem",
								border: "1px solid rgb(154 52 18 / 0.24)",
								borderRadius: "0.85rem",
								background: "#fff7ed",
								color: "#241b16",
								font: "inherit",
							})}
						/>
					</label>
					<button type="submit" mix={shortcutButtonStyles()}>
						Open album
					</button>
				</form>
				<button
					type="button"
					mix={[
						shortcutButtonStyles(),
						on<HTMLButtonElement, "click">("click", () => {
							let album =
								handle.props.albums[Math.floor(Math.random() * handle.props.albums.length)];

							if (!album) return;

							void router.submit(
								{ albumId: album.id },
								{ method: "POST", action: routes.openAlbum.href() },
							);
						}),
					]}
				>
					Surprise me
				</button>
			</section>
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

/** Shared button treatment for album shortcut actions. */
function shortcutButtonStyles() {
	return css({
		display: "inline-flex",
		minHeight: "2.85rem",
		alignItems: "center",
		justifyContent: "center",
		padding: "0.7rem 1rem",
		border: "1px solid rgb(154 52 18 / 0.18)",
		borderRadius: "999rem",
		background: "#fed7aa",
		color: "#7c2d12",
		cursor: "pointer",
		font: "inherit",
		fontWeight: 900,
		"&:focus-visible": {
			outline: "3px solid #f97316",
			outlineOffset: "4px",
		},
	});
}
