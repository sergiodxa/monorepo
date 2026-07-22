/**
 * AlbumsPage view for the gallery. It renders the album index as large tappable cards
 * plus a shortcut panel with a "Jump to album" number form and a "Surprise me" button
 * that opens a random album. It is the landing screen that lets visitors browse or jump
 * straight into any album.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Button, Form, Header, Heading, Label, NumberField, Toolbar } from "@pkg/r3-ui";
import { RouterProvider } from "@pkg/r3-ui-router";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@pkg/r3-ui/mixins";
import { focusRingByColor, panelChrome } from "@pkg/r3-ui/styles";
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
			<Toolbar
				mix={css({
					flexWrap: "wrap",
					justifyContent: "space-between",
					marginBlockEnd: "1.5rem",
					padding: "1rem",
				})}
				aria-label="Album shortcuts"
			>
				<Form
					method="POST"
					action={routes.openAlbum.href()}
					mix={[router.form(), css({ flexDirection: "row", flexWrap: "wrap", alignItems: "end" })]}
				>
					<NumberField>
						<Label htmlFor="albumId">Jump to album</Label>
						<NumberField.Group mix={stepper()}>
							<NumberField.DecrementButton
								command={NUMBER_FIELD_STEP_DOWN_COMMAND}
								commandfor="albumId"
								aria-label="Decrease album number"
							/>
							<NumberField.Input id="albumId" name="albumId" min={1} max={100} defaultValue={1} />
							<NumberField.IncrementButton
								command={NUMBER_FIELD_STEP_UP_COMMAND}
								commandfor="albumId"
								aria-label="Increase album number"
							/>
						</NumberField.Group>
					</NumberField>
					<Button type="submit" color="primary">
						Open album
					</Button>
				</Form>
				<Button
					type="button"
					color="primary"
					variant="outline"
					mix={on<HTMLButtonElement, "click">("click", () => {
						let album = handle.props.albums[Math.floor(Math.random() * handle.props.albums.length)];

						if (!album) return;

						void router.submit(
							{ albumId: album.id },
							{ method: "POST", action: routes.openAlbum.href() },
						);
					})}
				>
					Surprise me
				</Button>
			</Toolbar>
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
							data-color="primary"
							mix={[
								panelChrome(),
								focusRingByColor(),
								css({
									display: "grid",
									boxSizing: "border-box",
									minHeight: "13rem",
									padding: "1.2rem",
									borderRadius: "1.5rem",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									boxShadow: "0 1.5rem 4rem rgb(124 45 18 / 0.08)",
									color: "inherit",
									textDecoration: "none",
									transition:
										"transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease",
									WebkitTapHighlightColor: "transparent",
									"&:hover": {
										backgroundColor: "var(--ui-neutral-bg-tint-hover)",
										boxShadow: "0 2rem 5rem rgb(124 45 18 / 0.14)",
										transform: "translateY(-0.25rem)",
									},
									"@media (prefers-reduced-motion: reduce)": {
										transitionDuration: "0.01ms",
									},
								}),
							]}
							href={routes.album.href({ id: String(album.id) })}
						>
							<Header
								mix={css({
									alignSelf: "start",
									padding: 0,
									color: "var(--ui-primary-fg-emphasis)",
								})}
							>
								Album {album.id}
							</Header>
							<Heading
								mix={css({
									alignSelf: "end",
									fontFamily: 'Georgia, "Times New Roman", serif',
									fontSize: "1.8rem",
									fontWeight: 500,
									letterSpacing: "-0.04em",
									lineHeight: 1,
									color: "inherit",
								})}
							>
								{titleCase(album.title)}
							</Heading>
						</a>
					</li>
				))}
			</ul>
		</Shell>
	);
}
