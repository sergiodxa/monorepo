/**
 * The extras menu: a button opening a popover that lists the library screens given as children,
 * and a modal dialog per screen whose content renders only while it is open, so a screen loads
 * its library when the reader opens it. The children pick which screens a game offers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { Dialog, Menu } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { NovelLabels } from "./settings.js";

import { ChapterSelect, SceneReplay } from "./chapters.js";
import { Characters } from "./characters.js";
import { Encyclopedia } from "./encyclopedia.js";
import { EndingsList } from "./endings.js";
import { Gallery } from "./gallery.js";
import { Memories } from "./memories.js";
import { MusicRoom } from "./music-room.js";
import { NovelPlayer } from "./player.js";
import { quickMenuButton } from "./quick-menu.js";
import { ThemeBridge } from "./theme-bridge.js";
import { dialogSurface, dialogTitle } from "./theme.js";

/** A library screen the extras menu offers. */
export type LibraryScreen = Extract<
	NovelPlayer.Screen,
	| "memories"
	| "gallery"
	| "characters"
	| "encyclopedia"
	| "music"
	| "endings"
	| "chapters"
	| "scenes"
>;

export namespace Extras {
	/** Props {@link Extras} accepts. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/**
		 * The screens to offer, in menu order: `Memories`, `Encyclopedia`, `Gallery`, `Characters`,
		 * `MusicRoom`, `EndingsList`, `ChapterSelect` and `SceneReplay`, each with the props it needs,
		 * such as a music room's `titles`. Other children are left out.
		 */
		children?: RemixNode;
	}
}

/** Props of one screen's dialog; `mix` lands on the `<dialog>`, whose `toggle` reports it opening. */
export interface ScreenDialogProps extends Pick<Dialog.Props, "mix"> {
	id: string;
	title: string;
	closeLabel: string;
	/** True while the dialog is open, which is when its content renders and loads. */
	open: boolean;
	/** Widens the dialog to fit a screen that shows art beside a list, as the encyclopedia does. */
	wide?: boolean;
	children?: RemixNode;
}

/** One screen among the children: which one it is, its menu label, and the element to render. */
export interface OfferedScreen {
	screen: LibraryScreen;
	label: keyof NovelLabels;
	element: RemixElement;
}

/** The label each library screen's menu entry and dialog title read, in the extras menu's order. */
export const LIBRARY_SCREEN_LABELS: Readonly<Record<LibraryScreen, keyof NovelLabels>> = {
	memories: "memories",
	encyclopedia: "encyclopedia",
	characters: "characters",
	gallery: "gallery",
	music: "musicRoom",
	endings: "endings",
	chapters: "chapterSelect",
	scenes: "sceneReplay",
};

/** Which library screen each component is. */
function libraryScreenOf(type: unknown): LibraryScreen | undefined {
	if (type === Memories) return "memories";
	if (type === Gallery) return "gallery";
	if (type === Characters) return "characters";
	if (type === Encyclopedia) return "encyclopedia";
	if (type === MusicRoom) return "music";
	if (type === EndingsList) return "endings";
	if (type === ChapterSelect) return "chapters";
	if (type === SceneReplay) return "scenes";
	return undefined;
}

/** Which screen each library component is, and the label the menu names it by. */
function screenOf(type: unknown): Pick<OfferedScreen, "screen" | "label"> | undefined {
	let screen = libraryScreenOf(type);
	return screen === undefined ? undefined : { screen, label: LIBRARY_SCREEN_LABELS[screen] };
}

/** The library screens among `children`, in order, flattening arrays and fragments of them. */
export function offeredScreens(children: RemixNode): OfferedScreen[] {
	if (Array.isArray(children)) return children.flatMap((child) => offeredScreens(child));
	if (typeof children !== "object" || children === null || !("type" in children)) return [];
	let element = children as RemixElement;
	let known = screenOf(element.type);
	if (known !== undefined) return [{ ...known, element }];
	return offeredScreens(element.props.children as RemixNode);
}

/**
 * Offers the library screens from a menu, inside a player; it sits in the quick menu by default.
 * Closing the music room hands the music back to the frame.
 *
 * @example <NovelPlayer.Extras><Memories /><MusicRoom titles={titles} /><EndingsList /></NovelPlayer.Extras>
 */
export function Extras(handle: Handle<Extras.Props>) {
	let player = handle.context.get(NovelPlayer);
	let menuId = `${handle.id}-extras`.replace(/[^\w-]/g, "-");
	let open: LibraryScreen | undefined;

	/** Tracks which screen is open; closing a screen that plays music restores the frame's. */
	function toggle(screen: LibraryScreen, shown: boolean): void {
		if (shown) open = screen;
		else if (open === screen) {
			open = undefined;
			let frame = player.frame;
			if ((screen === "music" || screen === "encyclopedia") && frame !== undefined) {
				player.mixer.reconcile(frame.audio, player.locale, true);
			}
		}
		void handle.update();
	}

	return () => {
		let { children, mix, ...rest } = handle.props;
		let { labels, ids } = player;
		let screens = offeredScreens(children);
		if (screens.length === 0) return null;
		return (
			<span {...rest} data-novel-extras-menu="" mix={[css({ display: "contents" }), mix]}>
				<button
					type="button"
					data-action="extras"
					commandfor={menuId}
					command="toggle-popover"
					mix={quickMenuButton()}
				>
					{labels.extras}
				</button>
				<Menu id={menuId} placement="top-end" aria-label={labels.extras} data-novel-extras="">
					{screens.map(({ screen, label }) => (
						<Menu.Item
							key={screen}
							data-screen={screen}
							commandfor={ids[screen]}
							command="show-modal"
						>
							{labels[label]}
						</Menu.Item>
					))}
				</Menu>
				{screens.map(({ screen, label, element }) => (
					<ScreenDialog
						key={screen}
						id={ids[screen]}
						title={labels[label]}
						closeLabel={labels.close}
						open={open === screen}
						wide={screen === "characters" || screen === "encyclopedia"}
						mix={on("toggle", (event) =>
							toggle(screen, (event as ToggleEvent).newState === "open"),
						)}
					>
						{element}
					</ScreenDialog>
				))}
			</span>
		);
	};
}

/**
 * A library screen's modal dialog. Its content renders only while it is open, so a screen loads
 * the scenes it reads when the reader opens it.
 */
export function ScreenDialog(handle: Handle<ScreenDialogProps>) {
	return () => {
		let { id, title, closeLabel, open, wide, mix, children } = handle.props;
		return (
			<Dialog
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-screen=""
				data-novel-theme-surface="dialog"
				style={
					wide === true
						? { ...dialogSurface(), maxInlineSize: "none", inlineSize: "min(64rem, 96vw)" }
						: dialogSurface()
				}
				mix={[
					css({
						inlineSize: "min(48rem, 94vw)",
						cursor: "auto",
						userSelect: "text",
						textAlign: "start",
					}),
					mix,
				]}
			>
				<ThemeBridge />
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`} style={dialogTitle()}>
						{title}
					</Dialog.Title>
				</Dialog.Header>
				<div mix={css({ maxBlockSize: "65vh", overflowY: "auto" })}>{open ? children : null}</div>
				<Dialog.Close commandfor={id} aria-label={closeLabel} />
			</Dialog>
		);
	};
}
