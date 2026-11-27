/**
 * `NovelDevTools.Connect`: the developer tools' link inside a player or a title screen. Placed
 * among its parts, it hands the tools that context, so the panel opens screens, pushes toasts and
 * plays sounds, and it draws previewed library screens inside it, in the game's theme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Select } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import type { LibraryScreen } from "../ui/internal.js";

import {
	ChapterSelect,
	Characters,
	Encyclopedia,
	EndingsList,
	Gallery,
	Memories,
	MusicRoom,
	NovelPlayer,
	SceneReplay,
	Title,
} from "../ui.js";
import { LIBRARY_SCREEN_LABELS, ScreenDialog } from "../ui/internal.js";

import type { DevPlayer, DevTools } from "./devtools.js";
import type { LibraryPreset } from "./library.js";

export namespace DevToolsConnect {
	/** Props {@link DevToolsConnect} accepts. */
	export interface Props {
		devtools: DevTools;
	}
}

/** The libraries a preview reads, with the words the panel and the preview name them by. */
export const PRESET_LABELS: Readonly<Record<LibraryPreset, string>> = {
	current: "This play's library",
	unlocked: "Everything unlocked",
	locked: "Everything locked",
};

/**
 * Links the player or title screen it sits in to the tools until it leaves the page, and draws
 * the previewed screen; outside both it draws nothing. A player remounted by `restart`, or the
 * title a play returns to, links again as its new `Connect` mounts.
 *
 * @example <NovelPlayer.Default novel={novel} titleScreen={{ heading, parts: connect }}>{connect}</NovelPlayer.Default>
 */
export function DevToolsConnect(handle: Handle<DevToolsConnect.Props>) {
	let t = (key: string) => (intl(handle).t as (key: string) => string)(key);
	let link = linkOf(handle, t);
	let { devtools } = handle.props;
	let disconnect = link === undefined ? () => undefined : devtools.connect(link);
	let unsubscribe = devtools.subscribe(() => void handle.update());
	handle.signal.addEventListener("abort", () => {
		unsubscribe();
		disconnect();
	});
	return () =>
		link === undefined ? null : <ScreenPreview devtools={handle.props.devtools} link={link} />;
}

/** The surface `Connect` sits in: the player when it is inside one, or else the title screen. */
function linkOf(handle: Handle<DevToolsConnect.Props>, t: DevPlayer["t"]): DevPlayer | undefined {
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	if (player !== undefined) return { surface: "play", context: player, t };
	let title = handle.context.get(Title) as Title.Context | undefined;
	if (title !== undefined) return { surface: "title", context: title, t };
	return undefined;
}

/** Props of {@link ScreenPreview}. */
interface ScreenPreviewProps {
	devtools: DevTools;
	link: DevPlayer;
}

/**
 * The previewed screen in the library screens' own dialog, opened as a modal, with a switch
 * between libraries above it. Closing it ends the preview and, in a play, hands the music back to
 * the frame, as closing the music room does.
 */
function ScreenPreview(handle: Handle<ScreenPreviewProps>) {
	let dialog: HTMLDialogElement | undefined;
	let id = `${handle.id}-preview`.replace(/[^\w-]/g, "-");

	/** Ends the preview once its dialog closes, restoring the frame's music. */
	function closed(): void {
		let { devtools, link } = handle.props;
		let frame = link.surface === "play" ? link.context.frame : undefined;
		if (frame !== undefined) link.context.mixer.reconcile(frame.audio, link.context.locale, true);
		devtools.closePreview();
	}

	return () => {
		let { devtools, link } = handle.props;
		let { labels } = link.context;
		let preview = devtools.preview;
		if (preview === undefined) return null;
		handle.queueTask(() => {
			if (dialog !== undefined && !dialog.open) dialog.showModal();
		});
		let { screen, preset } = preview;
		return (
			<ScreenDialog
				key={`${screen}-${preset}`}
				id={id}
				title={labels[LIBRARY_SCREEN_LABELS[screen]]}
				closeLabel={labels.close}
				open
				wide={screen === "characters" || screen === "encyclopedia"}
				mix={[
					ref((node) => {
						dialog = node as HTMLDialogElement;
					}),
					on("close", closed),
				]}
			>
				<div data-novel-dev-preview={preset} mix={css({ display: "grid", gap: "8px" })}>
					<label
						htmlFor={`${id}-preset`}
						mix={css({ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" })}
					>
						Preview
						<Select
							id={`${id}-preset`}
							mix={on("change", (event) => {
								let next = event.currentTarget.value as LibraryPreset;
								void devtools.previewScreen(screen, next);
							})}
						>
							{(Object.keys(PRESET_LABELS) as LibraryPreset[]).map((each) => (
								<Select.Option value={each} selected={each === preset}>
									{PRESET_LABELS[each]}
								</Select.Option>
							))}
						</Select>
					</label>
					{screenElement(screen, preview.persistent, devtools)}
				</div>
			</ScreenDialog>
		);
	};
}

/**
 * The library screen component for `screen`, reading `persistent` instead of the player's record.
 *
 * @returns The element the preview dialog holds.
 */
function screenElement(
	screen: LibraryScreen,
	persistent: unknown,
	devtools: DevTools,
): RemixElement {
	let props = { novel: devtools.novel, persistent };
	switch (screen) {
		case "memories":
			return <Memories {...props} />;
		case "gallery":
			return <Gallery {...props} />;
		case "characters":
			return <Characters {...props} />;
		case "encyclopedia":
			return <Encyclopedia {...props} />;
		case "music":
			return <MusicRoom {...props} />;
		case "endings":
			return <EndingsList {...props} />;
		case "chapters":
			return <ChapterSelect {...props} />;
		case "scenes":
			return <SceneReplay {...props} />;
	}
}
