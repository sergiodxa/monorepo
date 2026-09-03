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

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded, transition, transitionDuration } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import {
	boxSizing,
	flex,
	flexRow,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	items,
	justify,
	repeat,
	self,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { height, m, mbe, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { translateY } from "@sdxc/u/transform";
import { fontSize, leading, lineClamp, textDecoration, tracking, weight } from "@sdxc/u/typography";
import { Button, Form, Header, Heading, Label, NumberField, Toolbar } from "@sdxc/ui";
import { RouterProvider } from "@sdxc/ui-router";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@sdxc/ui/mixins";
import { panelChrome } from "@sdxc/ui/styles";
import { on } from "remix/ui";

import type { Album } from "../data/types";

import { AlbumSearch } from "../components/album-search";
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
				mix={[flexWrap("wrap"), justify("between"), mbe("1.5rem"), p("1rem")]}
				aria-label="Album shortcuts"
			>
				<Form
					method="POST"
					action={routes.openAlbum.href()}
					mix={[router.form(), flexRow(), flexWrap("wrap"), items("end")]}
				>
					<NumberField>
						<Label htmlFor="albumId" mix={visuallyHidden()}>
							Jump to album
						</Label>
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
					<Button type="submit" color="brand">
						Open album
					</Button>
				</Form>
				<div mix={[flex(), flexWrap("wrap"), items("center"), gap("0.5rem")]}>
					<Button
						type="button"
						color="brand"
						variant="outline"
						mix={on<HTMLButtonElement, "click">("click", () => {
							let album =
								handle.props.albums[Math.floor(Math.random() * handle.props.albums.length)];

							if (!album) return;

							void router.submit(
								{ albumId: album.id },
								{ method: "POST", action: routes.openAlbum.href() },
							);
						})}
					>
						Surprise me
					</Button>
					<AlbumSearch albums={handle.props.albums} />
				</div>
			</Toolbar>
			<ul
				mix={[
					grid(),
					gridTemplate({ columns: repeat("auto-fit", "minmax(min(100%, 15rem), 1fr)") }),
					gap("1rem"),
					m(0),
					p(0),
					listStyle("none"),
				]}
				aria-label="Albums"
			>
				{handle.props.albums.map((album) => (
					<li key={album.id}>
						<a
							data-color="brand"
							mix={[
								panelChrome(),
								when("&:focus-visible", [
									outline({ color: "brand.ring", offset: 2 }),
									when('&[data-color="neutral"]', outline("neutral.ring")),
									when('&[data-color="success"]', outline("success.ring")),
									when('&[data-color="warning"]', outline("warning.ring")),
									when('&[data-color="danger"]', outline("danger.ring")),
								]),
								grid(),
								boxSizing("border-box"),
								overflow("hidden"),
								height("14rem"),
								p("1.2rem"),
								rounded("1.5rem"),
								bg("neutral.tint"),
								fg("inherit"),
								textDecoration("none"),
								transition("transform, box-shadow, background-color", {
									duration: 180,
									easing: "ease",
								}),
								raw({
									boxShadow: "0 1.5rem 4rem rgb(124 45 18 / 0.08)",
									WebkitTapHighlightColor: "transparent",
								}),
								hover([
									bg("neutral.bg-tint-hover"),
									raw({ boxShadow: "0 2rem 5rem rgb(124 45 18 / 0.14)" }),
									translateY("-0.25rem"),
								]),
								media("(prefers-reduced-motion: reduce)", transitionDuration("0.01ms")),
							]}
							href={routes.album.href({ id: String(album.id) })}
						>
							<Header mix={[self("start"), p(0), fg("brand.emphasis")]}>Album {album.id}</Header>
							<Heading
								mix={[
									self("end"),
									raw({ fontFamily: 'Georgia, "Times New Roman", serif' }),
									fontSize("1.8rem"),
									weight(500),
									tracking("-0.04em"),
									leading(1.1),
									fg("inherit"),
									lineClamp(3),
								]}
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
