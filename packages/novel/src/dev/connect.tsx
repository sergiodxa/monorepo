/**
 * `NovelDevTools.Connect`: the developer tools' link inside a player. Placed among the player's
 * parts, it hands the tools the player's context, so the panel opens its screens, pushes toasts
 * and plays sounds, and it draws previewed library screens inside the player, in the game's theme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Select } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import type { LibraryScreen } from "../ui/extras.js";
import type { NovelLabels } from "../ui/settings.js";

import { ChapterSelect, SceneReplay } from "../ui/chapters.js";
import { Characters } from "../ui/characters.js";
import { Encyclopedia } from "../ui/encyclopedia.js";
import { EndingsList } from "../ui/endings.js";
import { ScreenDialog } from "../ui/extras.js";
import { Gallery } from "../ui/gallery.js";
import { Memories } from "../ui/memories.js";
import { MusicRoom } from "../ui/music-room.js";
import { NovelPlayer } from "../ui/player.js";

import type { DevTools } from "./devtools.js";
import type { LibraryPreset } from "./library.js";

export namespace DevToolsConnect {
	/** Props {@link DevToolsConnect} accepts. */
	export interface Props {
		devtools: DevTools;
	}
}

/** The label each library screen's title reads from, as the extras menu names it. */
export const SCREEN_LABELS: Readonly<Record<LibraryScreen, keyof NovelLabels>> = {
	memories: "memories",
	encyclopedia: "encyclopedia",
	characters: "characters",
	gallery: "gallery",
	music: "musicRoom",
	endings: "endings",
	chapters: "chapterSelect",
	scenes: "sceneReplay",
};

/** The libraries a preview reads, with the words the panel and the preview name them by. */
export const PRESET_LABELS: Readonly<Record<LibraryPreset, string>> = {
	current: "This play's library",
	unlocked: "Everything unlocked",
	locked: "Everything locked",
};

/**
 * Links the player it sits in to the tools until it leaves the page, and draws the previewed
 * screen. A player remounted by `restart` links again as its new `Connect` mounts.
 *
 * @example <NovelPlayer.Default novel={novel}><NovelDevTools.Connect devtools={devtools} /></NovelPlayer.Default>
 */
export function DevToolsConnect(handle: Handle<DevToolsConnect.Props>) {
	let player = handle.context.get(NovelPlayer);
	let { devtools } = handle.props;
	let disconnect = devtools.connect({
		context: player,
		t: (key) => (intl(handle).t as (key: string) => string)(key),
	});
	let unsubscribe = devtools.subscribe(() => void handle.update());
	handle.signal.addEventListener("abort", () => {
		unsubscribe();
		disconnect();
	});
	return () => <ScreenPreview devtools={handle.props.devtools} player={player} />;
}

/** Props of {@link ScreenPreview}. */
interface ScreenPreviewProps {
	devtools: DevTools;
	player: NovelPlayer.Context;
}

/**
 * The previewed screen in the player's own screen dialog, opened as a modal, with a switch
 * between libraries above it. Closing it ends the preview and hands the music back to the frame,
 * as closing the music room does.
 */
function ScreenPreview(handle: Handle<ScreenPreviewProps>) {
	let dialog: HTMLDialogElement | undefined;
	let id = `${handle.id}-preview`.replace(/[^\w-]/g, "-");

	/** Ends the preview once its dialog closes, restoring the frame's music. */
	function closed(): void {
		let { devtools, player } = handle.props;
		let frame = player.frame;
		if (frame !== undefined) player.mixer.reconcile(frame.audio, player.locale, true);
		devtools.closePreview();
	}

	return () => {
		let { devtools, player } = handle.props;
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
				title={player.labels[SCREEN_LABELS[screen]]}
				closeLabel={player.labels.close}
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
