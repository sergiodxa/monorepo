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

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { block } from "@sdxc/u/layout";
import { is, p, pb, pi, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { textDecoration } from "@sdxc/u/typography";
import { Button, Command, Keyboard } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandFilter, commandKeys, hotkey } from "@sdxc/ui/mixins";
import { on } from "remix/ui";

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
 * match with arrow keys and follows it on Enter, which needs no arrow press once typing alone narrows the results to a single match.
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
				color="brand"
				variant="outline"
				commandfor={DIALOG_ID}
				command="show-modal"
			>
				Search albums
				<Keyboard mix={fg("inherit")}>⌘K</Keyboard>
			</Button>
			<dialog
				id={DIALOG_ID}
				aria-label="Search albums"
				mix={[
					hotkey("mod+k"),
					border("none"),
					p(0),
					rounded("lg"),
					width("min(90vw, 28rem)"),
					when("&::backdrop", bg("rgb(36 27 22 / 0.5)")),
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
								mix={p(0)}
							>
								<a
									href={routes.album.href({ id: String(album.id) })}
									mix={[
										block(),
										is("full"),
										pi("0.5rem"),
										pb("0.5rem"),
										fg("inherit"),
										textDecoration("none"),
									]}
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
