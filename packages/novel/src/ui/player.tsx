/**
 * `NovelPlayer`: owns a play, renders its current frame on the stage with the textbox, menu,
 * captions and quick menu, and wires every input (click, keys, wheel, touch, gamepad) and screen
 * (backlog, saves, settings). Storage stays the app's, through `onSave` and `onSettingsChange`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Trans } from "@sdxc/i18n/ui";
import type { Handle, Props as TagProps, RemixElement, RemixNode } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on, ref } from "remix/component";

import type { CustomFrame, Ending, GameState, Reply } from "../frames.js";
import type { Novel, StartOptions } from "../novel.js";

import type { NovelLabels, NovelSettings, PlayerAction, StoredSettings } from "./settings.js";

import { Backlog } from "./backlog.js";
import { ChoiceMenu } from "./choice-menu.js";
import { Director } from "./director.js";
import { gamepadActions, moveFocus, swipeDirection } from "./input.js";
import { Message } from "./message.js";
import { QuickMenu } from "./quick-menu.js";
import { QUICK_SLOT, SaveScreen } from "./saves.js";
import { SettingsScreen } from "./settings-screen.js";
import { DEFAULT_LABELS, KEYMAP, resolveSettings } from "./settings.js";
import { Stage } from "./stage.js";
import { Captions, Textbox } from "./textbox.js";

/** Milliseconds between two wheel actions, so one flick of a trackpad rolls back one stop. */
const WHEEL_INTERVAL_MS = 300;

/** Elements whose clicks belong to themselves rather than advancing the story. */
const INTERACTIVE =
	"button, a, input, select, textarea, label, dialog, [data-novel-ui], [data-novel-interaction]";

/** A typeface stack with dyslexia-friendly faces first; the app loads the web font it prefers. */
const DYSLEXIA_FONT = '"OpenDyslexic", "Atkinson Hyperlegible", "Lexend", Verdana, sans-serif';

export namespace NovelPlayer {
	/** Props an interaction component receives for a custom frame. */
	export interface InteractionProps {
		frame: CustomFrame;
		/** Answers the frame; pass `frame.complete(output)`. */
		respond: (reply: Reply) => void;
	}

	/** A component that renders a custom frame, written by the app. */
	export type Interaction = (handle: Handle<InteractionProps>) => () => RemixNode;

	/** Props {@link NovelPlayer} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/** Where the play starts: a scene, a state, a seed, a save through `from`, and `persistent` data. */
		start?: StartOptions;
		/** The settings the app stored; missing fields take their defaults. */
		settings?: StoredSettings;
		/** Called with the whole settings object whenever the reader changes one. */
		onSettingsChange?: (settings: NovelSettings) => void;
		/** The saves the app stored, by slot name. */
		saves?: Readonly<Record<string, GameState>>;
		/**
		 * Called when the reader saves, with the slot and the play as JSON, for the app to store; the
		 * save also reaches the novel's `save` event, so an app listening there can leave this out.
		 */
		onSave?: (slot: string, state: GameState) => void;
		/**
		 * How many numbered save slots the save and load screens show, beside the quick slot.
		 *
		 * @default 6
		 */
		slots?: number;
		/**
		 * Shows speaker focus: the speaker enlarged and raised, everyone else dimmed.
		 *
		 * @default true
		 */
		focus?: boolean;
		/** Renders custom frames; without it a custom frame shows the stage and waits. */
		renderInteraction?: Interaction;
		/** Called when the play reaches an ending or runs out of story. */
		onEnding?: (ending: Ending) => void;
		/** Replaces any of the interface's English labels. */
		labels?: Partial<NovelLabels>;
		/** Markup elements for lines, beside `b`, `i`, `shake`, `speed` and `pause`. */
		markup?: Record<string, RemixElement | Trans.MarkupComponent>;
	}
}

/**
 * Plays a novel. It reads its translator from `IntlProvider` (or `setIntl`), and since a novel
 * holds functions it renders inside the app's own client entry rather than as one.
 *
 * @example <NovelPlayer novel={novel} settings={stored} onSettingsChange={store} saves={saves} onSave={write} />
 */
export function NovelPlayer(handle: Handle<NovelPlayer.Props>) {
	let root: HTMLElement | undefined;
	let stage: HTMLElement | undefined;
	let seenSettings: StoredSettings | undefined;
	let settings = resolveSettings(handle.props.settings);
	seenSettings = handle.props.settings;
	let seenSaves: NovelPlayer.Props["saves"];
	let saves: Record<string, GameState> = {};
	let hidden = false;
	let lastWheel = 0;
	let touch: { x: number; y: number } | undefined;
	let suppressClick = 0;
	let pads = new Map<number, boolean[]>();
	let polling = false;
	let ids = {
		backlog: `${handle.id}-backlog`.replace(/[^\w-]/g, "-"),
		save: `${handle.id}-save`.replace(/[^\w-]/g, "-"),
		load: `${handle.id}-load`.replace(/[^\w-]/g, "-"),
		settings: `${handle.id}-settings`.replace(/[^\w-]/g, "-"),
	};

	let director = new Director({
		novel: () => handle.props.novel,
		render: async () => {
			await handle.update();
		},
		stage: () => stage ?? null,
		locale: () => intl(handle).locale,
		text: () =>
			root?.querySelector("[data-novel-textbox], [data-novel-choices]")?.textContent?.trim() ?? "",
		settings: () => settings,
		onEnding: (ending) => handle.props.onEnding?.(ending),
	});

	handle.signal.addEventListener("abort", () => director.dispose());
	handle.queueTask(() => {
		if (handle.signal.aborted) return;
		void director.begin(handle.props.start);
		document.addEventListener("keydown", keydown, { signal: handle.signal });
		document.addEventListener("keyup", keyup, { signal: handle.signal });
		window.addEventListener("blur", () => director.holdSkip(false), { signal: handle.signal });
		window.addEventListener("gamepadconnected", startPolling, { signal: handle.signal });
		if (navigator.getGamepads?.().some((pad) => pad !== null)) startPolling();
	});

	/** The dialog open in the player, which takes keys and the gamepad while it is open. */
	function openDialog(): HTMLDialogElement | null {
		return root?.querySelector<HTMLDialogElement>("dialog[open]") ?? null;
	}

	/** Opens one of the player's dialogs. */
	function show(id: string): void {
		let dialog = root?.querySelector<HTMLDialogElement>(`#${id}`);
		if (dialog !== null && dialog !== undefined && !dialog.open) dialog.showModal();
	}

	/** Saves the play into `slot`, keeping the save locally so the screens show it at once. */
	function save(slot: string): void {
		let state = director.save(slot);
		if (state === undefined) return;
		saves = { ...saves, [slot]: state };
		handle.props.onSave?.(slot, state);
		void handle.update();
	}

	/** Resumes the play saved in `slot`. */
	function load(slot: string): void {
		let state = saves[slot];
		if (state !== undefined) void director.load(state);
	}

	/** Stores changed settings and hands them to the app. */
	function changeSettings(next: NovelSettings): void {
		settings = next;
		director.mixer.setVolume(next.volume);
		if (!next.selfVoicing && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
		handle.props.onSettingsChange?.(next);
		void handle.update();
	}

	/** Shows or hides the interface; a hidden interface comes back on the next click or key. */
	function toggleHidden(): void {
		hidden = !hidden;
		void handle.update();
	}

	/** Enters or leaves full screen with the player as the full-screen element. */
	function toggleFullscreen(): void {
		if (document.fullscreenElement !== null) {
			void document.exitFullscreen().catch(() => undefined);
			return;
		}
		void root?.requestFullscreen().catch(() => undefined);
	}

	/** Runs one of the player's actions, from a key, the quick menu or the gamepad. */
	function run(action: PlayerAction): void {
		if (hidden && action !== "hide" && action !== "fullscreen") {
			toggleHidden();
			return;
		}
		if (action === "advance") director.advance();
		else if (action === "auto") director.toggleAuto();
		else if (action === "skip") director.toggleSkip();
		else if (action === "rollback") void director.rollback();
		else if (action === "hide") toggleHidden();
		else if (action === "fullscreen") toggleFullscreen();
		else if (action === "quickSave") save(QUICK_SLOT);
		else if (action === "quickLoad") load(QUICK_SLOT);
		else if (action === "backlog") show(ids.backlog);
		else if (action === "save") show(ids.save);
		else if (action === "load") show(ids.load);
		else show(ids.settings);
	}

	/** Maps a key to its action while the player has the page's attention. */
	function keydown(event: KeyboardEvent): void {
		if (root === undefined || !root.isConnected) return;
		let active = document.activeElement;
		if (active !== null && active !== document.body && !root.contains(active)) return;
		void director.mixer.resume();
		if (event.key === "Control") {
			director.holdSkip(true);
			return;
		}
		if (openDialog() !== null || event.ctrlKey || event.metaKey || event.altKey) return;
		let target = event.target as Element | null;
		if (target?.closest("input, select, textarea, [contenteditable]") !== null && target !== null)
			return;
		let onButton = target?.closest("button") !== null && target !== null;
		if (onButton && (event.key === " " || event.key === "Enter")) return;
		let action = KEYMAP[event.key] ?? KEYMAP[event.key.toLowerCase()];
		if (action === undefined) return;
		event.preventDefault();
		run(action);
	}

	/** Stops skipping when Control is released. */
	function keyup(event: KeyboardEvent): void {
		if (event.key === "Control") director.holdSkip(false);
	}

	/** Polls connected gamepads once per frame while any is connected. */
	function startPolling(): void {
		if (polling) return;
		polling = true;
		let poll = () => {
			if (handle.signal.aborted) return;
			let connected = (navigator.getGamepads?.() ?? []).filter((pad) => pad !== null);
			for (let pad of connected) {
				let buttons = pad.buttons.map((button) => button.pressed);
				for (let action of gamepadActions(pads.get(pad.index) ?? [], buttons)) gamepad(action);
				pads.set(pad.index, buttons);
			}
			if (connected.length === 0) {
				polling = false;
				return;
			}
			requestAnimationFrame(poll);
		};
		requestAnimationFrame(poll);
	}

	/** Runs a gamepad action: focus moves through controls, A presses the focused one or advances. */
	function gamepad(action: ReturnType<typeof gamepadActions>[number]): void {
		if (root === undefined) return;
		void director.mixer.resume();
		let dialog = openDialog();
		if (action === "focus-next" || action === "focus-previous") {
			moveFocus(dialog ?? root, action === "focus-next" ? 1 : -1);
			return;
		}
		if (action === "activate") {
			let focused = document.activeElement;
			if (
				focused instanceof HTMLElement &&
				root.contains(focused) &&
				focused.matches(INTERACTIVE)
			) {
				focused.click();
			} else run("advance");
			return;
		}
		if (action === "back") {
			if (dialog === null) toggleHidden();
			else dialog.close();
			return;
		}
		if (dialog !== null) return;
		if (action === "rollback") run("rollback");
		else if (action === "skip") run("skip");
		else run("settings");
	}

	return () => {
		let {
			novel: _novel,
			start: _start,
			settings: stored,
			onSettingsChange: _onSettingsChange,
			saves: storedSaves,
			onSave: _onSave,
			slots = 6,
			focus = true,
			renderInteraction,
			onEnding: _onEnding,
			labels: labelOverrides,
			markup,
			mix,
			...rest
		} = handle.props;
		if (stored !== seenSettings) {
			seenSettings = stored;
			settings = resolveSettings(stored);
		}
		if (storedSaves !== seenSaves) {
			seenSaves = storedSaves;
			saves = { ...storedSaves };
		}
		let labels = { ...DEFAULT_LABELS, ...labelOverrides };
		let locale = intl(handle).locale;
		let frame = director.frame;
		let showUi = !hidden && director.ending === undefined;
		let Interaction = renderInteraction;
		let staged = director.phase !== "staging";
		return (
			<div
				{...rest}
				data-novel-player=""
				data-phase={director.phase}
				data-auto={String(director.auto)}
				data-skip={String(director.skipping)}
				data-hidden={String(hidden)}
				data-dyslexia={String(settings.dyslexiaFont)}
				style={{ "--novel-font-scale": settings.fontSize }}
				mix={[
					ref((node) => {
						root = node;
					}),
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						background: "var(--novel-letterbox, #000)",
						color: "#fff",
						'&[data-dyslexia="true"]': {
							"--novel-text-font": DYSLEXIA_FONT,
							"--novel-text-tracking": "0.05em",
							"--novel-text-word-spacing": "0.16em",
							"--novel-text-leading": "1.7",
						},
					}),
					on("pointerdown", () => void director.mixer.resume()),
					on("wheel", (event) => {
						if (openDialog() !== null || event.deltaY === 0) return;
						if (event.timeStamp - lastWheel < WHEEL_INTERVAL_MS) return;
						lastWheel = event.timeStamp;
						run(event.deltaY < 0 ? "rollback" : "advance");
					}),
					mix,
				]}
			>
				<Stage
					stage={frame?.stage ?? { background: null, image: null, characters: [] }}
					locale={locale}
					focus={focus}
					instant={director.instant}
					mix={[
						ref((node) => {
							stage = node;
						}),
						css({ touchAction: "none", cursor: "pointer", userSelect: "none" }),
						on("pointerdown", (event) => {
							touch =
								event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : undefined;
						}),
						on("pointerup", (event) => {
							let start = touch;
							touch = undefined;
							if (start === undefined) return;
							let direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
							if (direction === null) return;
							suppressClick = event.timeStamp;
							if (direction === "down") run("backlog");
							else if (direction === "up") run("rollback");
						}),
						on("click", (event) => {
							if (suppressClick !== 0 && event.timeStamp - suppressClick < 500) return;
							if ((event.target as Element).closest(INTERACTIVE) !== null) return;
							if (hidden) {
								toggleHidden();
								return;
							}
							director.advance();
						}),
					]}
				>
					{showUi && frame !== undefined ? (
						<Captions sounds={frame.audio.sounds} data-novel-ui="" />
					) : null}
					{showUi && frame?.type === "line" ? (
						<Textbox
							frame={frame}
							typing={director.phase === "typing" || director.phase === "waiting"}
							complete={director.complete}
							textSpeed={settings.textSpeed}
							markup={markup}
							onRevealed={() => director.revealed()}
						/>
					) : null}
					{showUi && frame?.type === "choice" && staged ? (
						<ChoiceMenu
							frame={frame}
							timeLeftLabel={labels.timeLeft}
							onChoose={(option) => director.reply(frame.choose(option))}
						/>
					) : null}
					{frame?.type === "custom" && staged && Interaction !== undefined ? (
						<div data-novel-interaction="" mix={css({ position: "absolute", inset: 0, zIndex: 4 })}>
							<Interaction frame={frame} respond={(reply) => director.reply(reply)} />
						</div>
					) : null}
					{director.ending?.key === null || director.ending === undefined ? null : (
						<p
							data-novel-ending=""
							mix={css({
								position: "absolute",
								inset: 0,
								margin: 0,
								display: "grid",
								placeItems: "center",
								fontSize: "6cqh",
								background: "rgb(0 0 0 / 0.55)",
								zIndex: 6,
							})}
						>
							<Message i18nKey={director.ending.key} />
						</p>
					)}
					{director.error === undefined ? null : (
						<div
							role="alert"
							data-novel-ui=""
							data-novel-error={director.error.code}
							mix={css({
								position: "absolute",
								insetBlockStart: "3cqh",
								insetInline: "20cqw",
								padding: "1.5cqh 2cqw",
								borderRadius: "1cqh",
								background: "rgb(120 20 30 / 0.9)",
								fontSize: "2.4cqh",
								zIndex: 7,
							})}
						>
							<p mix={css({ margin: 0 })}>{director.error.message}</p>
							{director.stalled ? (
								<button type="button" mix={on("click", () => director.retry())}>
									{labels.retry}
								</button>
							) : null}
						</div>
					)}
					{showUi ? (
						<QuickMenu
							auto={director.auto}
							skip={director.skipping}
							dialogs={ids}
							labels={labels}
							onAction={run}
						/>
					) : null}
				</Stage>
				<Backlog
					id={ids.backlog}
					entries={director.backlog}
					labels={labels}
					onReplayVoice={(entry) => director.replayVoice(entry)}
				/>
				<SaveScreen
					id={ids.save}
					mode="save"
					slots={[QUICK_SLOT, ...Array.from({ length: slots }, (_, index) => String(index + 1))]}
					saves={saves}
					locale={locale}
					labels={labels}
					onSelect={save}
				/>
				<SaveScreen
					id={ids.load}
					mode="load"
					slots={[QUICK_SLOT, ...Array.from({ length: slots }, (_, index) => String(index + 1))]}
					saves={saves}
					locale={locale}
					labels={labels}
					onSelect={load}
				/>
				<SettingsScreen
					id={ids.settings}
					settings={settings}
					labels={labels}
					onChange={changeSettings}
				/>
			</div>
		);
	};
}
