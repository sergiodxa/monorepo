/**
 * AlbumSearch component for the gallery. It renders a visible "Search albums"
 * trigger plus a mod+k command palette listing every album, narrowed as the
 * visitor types and each result linking straight to its album page. Arrow
 * keys move the active result and Enter follows it, so the palette stays
 * fully keyboard-driven once its filtered list narrows down. It gives the
 * gallery a fast, keyboard-driven way to jump to any album by title.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Button, Command, Keyboard } from "@pkg/r3-ui";
import { FilterModel } from "@pkg/r3-ui/behaviors";
import { commandFilter, commandKeys, hotkey } from "@pkg/r3-ui/mixins";
import { css, on } from "remix/ui";

import type { Album } from "../data/types";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/** Dialog id the trigger button and the hotkey mixin both target. */
const DIALOG_ID = "album-search";

/**
 * Props for the album search palette.
 */
export interface AlbumSearchProps {
	albums: Album[];
}

/**
 * Renders a trigger button and its paired mod+k command palette for jumping
 * straight to any album by title. `commandKeys(model)` moves the active
 * match with the arrow keys and follows it on Enter — since the model
 * already keeps the sole remaining match active as soon as typing narrows
 * down to it, Enter selects it with no arrow press required.
 *
 * @param handle Component handle carrying the searchable albums.
 * @returns The search trigger and its dialog.
 */
export function AlbumSearch(handle: Handle<AlbumSearchProps>) {
	let model = new FilterModel();

	return () => (
		<>
			<Button
				type="button"
				color="primary"
				variant="outline"
				commandfor={DIALOG_ID}
				command="show-modal"
			>
				Search albums
				<Keyboard mix={css({ color: "inherit" })}>⌘K</Keyboard>
			</Button>
			<dialog
				id={DIALOG_ID}
				aria-label="Search albums"
				mix={[
					hotkey("mod+k"),
					css({
						border: "none",
						padding: 0,
						borderRadius: "var(--ui-radius-lg, 0.5rem)",
						width: "min(90vw, 28rem)",
						"&::backdrop": {
							backgroundColor: "rgb(36 27 22 / 0.5)",
						},
					}),
					on<HTMLDialogElement, "click">("click", (event) => {
						if (event.target === event.currentTarget) event.currentTarget.close();
					}),
				]}
			>
				<Command aria-label="Search albums" mix={[commandFilter(model), commandKeys(model)]}>
					<Command.Input placeholder="Search albums..." aria-label="Search albums" />
					<Command.List>
						{handle.props.albums.map((album) => (
							<Command.Item
								key={album.id}
								id={`album-search-item-${album.id}`}
								value={album.title}
								mix={css({ padding: 0 })}
							>
								<a
									href={routes.album.href({ id: String(album.id) })}
									mix={css({
										display: "block",
										inlineSize: "100%",
										paddingInline: "0.5rem",
										paddingBlock: "0.5rem",
										color: "inherit",
										textDecoration: "none",
									})}
								>
									{titleCase(album.title)}
								</a>
							</Command.Item>
						))}
					</Command.List>
					<Command.Empty>No albums match your search.</Command.Empty>
				</Command>
			</dialog>
		</>
	);
}
