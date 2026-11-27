/**
 * The panel's tools that reach past the play: screen previews over any library, unlocks edited
 * one by one, why each character counts as met, and the linked player's or title's toasts,
 * interface sounds, full screen and title screen. Each is a native disclosure like the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button, Checkbox, Disclosure, Select } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { Persistent } from "../persistent.js";
import type { InterfaceSoundRole } from "../ui.js";
import type { LibraryScreen } from "../ui/internal.js";

import { DEFAULT_LABELS } from "../ui.js";
import { LIBRARY_SCREEN_LABELS } from "../ui/internal.js";

import type { DevTools, PlayerScreen } from "./devtools.js";
import type { CastReport, LibraryPreset, UnlockCatalog } from "./library.js";
import type { SampleKind } from "./samples.js";

import { PRESET_LABELS } from "./connect.js";
import { lockedPersistent, unlockedPersistent } from "./library.js";
import { SAMPLE_KINDS } from "./samples.js";

/** Props every tool section receives. */
export interface SectionProps {
	devtools: DevTools;
}

/** Shown in a section that drives the player while none is linked. */
const UNLINKED =
	"Place <NovelDevTools.Connect> among the player's parts, or the title screen's, to use these tools.";

/** Shown beside the tools only a running play answers, while the title screen is linked. */
const ON_TITLE = "The title screen is showing; start a play for its toasts and screens.";

/** What each interface sound's button reads. */
const SOUND_LABELS: Readonly<Record<InterfaceSoundRole, string>> = {
	hover: "Hover sound",
	select: "Select sound",
};

/** The player screens the Screens section opens over the running play, with their labels. */
const PLAYER_SCREENS: readonly [PlayerScreen, keyof typeof DEFAULT_LABELS][] = [
	["settings", "settings"],
	["save", "save"],
	["load", "load"],
	["backlog", "backlog"],
];

/** The words each sample toast's button reads. */
const SAMPLE_LABELS: Readonly<Record<SampleKind, string>> = {
	entry: "New entry",
	bio: "Bio section",
	image: "CG unlocked",
	music: "Track unlocked",
	ending: "Ending",
	notify: "Story notification",
};

/** The lists of persistent data the Unlocks section edits, with the words it names them by. */
const UNLOCK_LISTS = [
	["images", "Gallery images"],
	["music", "Music tracks"],
	["sprites", "Character looks"],
	["entries", "Encyclopedia entries"],
	["bios", "Bio sections"],
	["characters", "Characters met (introduced)"],
	["endings", "Endings"],
	["chapters", "Chapters"],
] as const;

/** A list the Unlocks section edits, named by its catalog field. */
type UnlockList = (typeof UNLOCK_LISTS)[number][0];

/** A wrapping row of small buttons. */
const ROW = { display: "flex", flexWrap: "wrap", gap: "4px" } as const;

/**
 * Opens any library screen over the play's library, everything unlocked or everything locked,
 * inside the linked player so its theme applies, and the player's own screens over the play.
 */
export function ScreensSection(handle: Handle<SectionProps>) {
	let preset: LibraryPreset = "current";
	return () => {
		let { devtools } = handle.props;
		let labels = devtools.player?.labels ?? devtools.title?.labels ?? DEFAULT_LABELS;
		let disabled = !devtools.linked;
		let onTitle = devtools.title !== undefined;
		return (
			<Disclosure>
				<Disclosure.Trigger>Screens</Disclosure.Trigger>
				<Disclosure.Panel>
					<div mix={css({ display: "grid", gap: "8px" })}>
						{disabled ? <p>{UNLINKED}</p> : null}
						<label htmlFor={`${handle.id}-preset`} mix={css({ display: "grid", gap: "4px" })}>
							Library
							<Select
								id={`${handle.id}-preset`}
								name="library"
								mix={on("change", (event) => {
									preset = event.currentTarget.value as LibraryPreset;
									void handle.update();
								})}
							>
								{(Object.keys(PRESET_LABELS) as LibraryPreset[]).map((each) => (
									<Select.Option value={each} selected={each === preset}>
										{PRESET_LABELS[each]}
									</Select.Option>
								))}
							</Select>
						</label>
						<div role="group" aria-label="Library screens" mix={css(ROW)}>
							{(Object.keys(LIBRARY_SCREEN_LABELS) as LibraryScreen[]).map((screen) => (
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={disabled}
									data-screen={screen}
									mix={on("click", () => void devtools.previewScreen(screen, preset))}
								>
									{labels[LIBRARY_SCREEN_LABELS[screen]]}
								</Button>
							))}
						</div>
						<div role="group" aria-label="Player screens" mix={css(ROW)}>
							{PLAYER_SCREENS.map(([screen, label]) => (
								<Button
									type="button"
									size="sm"
									variant="ghost"
									disabled={disabled || (onTitle && screen !== "settings")}
									data-screen={screen}
									mix={on("click", () => void devtools.openScreen(screen))}
								>
									{labels[label]}
								</Button>
							))}
						</div>
					</div>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/**
 * Every id persistent data can hold, as a checkbox per id; checking one restarts the play on its
 * line with the edited record, which the app then stores. Read lines toggle all at once, since a
 * novel holds thousands. The lists load on request, since reading them imports every lazy scene.
 */
export function UnlocksSection(handle: Handle<SectionProps>) {
	let catalog: UnlockCatalog | undefined;

	/** Restarts the play with `change` applied to a copy of its record. */
	function apply(change: (record: Persistent) => Persistent): void {
		let current = handle.props.devtools.persistent;
		if (current === undefined) return;
		void handle.props.devtools.edit(change(structuredClone(current)));
	}

	return () => {
		let { devtools } = handle.props;
		let record = devtools.persistent;
		return (
			<Disclosure>
				<Disclosure.Trigger>Unlocks</Disclosure.Trigger>
				<Disclosure.Panel>
					<div mix={css({ display: "grid", gap: "8px" })}>
						<Button
							type="button"
							size="sm"
							variant="outline"
							mix={on("click", async (_event, signal) => {
								let read = await devtools.catalog();
								if (signal.aborted) return;
								catalog = read;
								void handle.update();
							})}
						>
							{catalog === undefined ? "Load the unlock lists" : "Load them again"}
						</Button>
						{catalog === undefined || record === undefined ? null : (
							<UnlockLists catalog={catalog} record={record} apply={apply} />
						)}
					</div>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/** Props of {@link UnlockLists}. */
interface UnlockListsProps {
	catalog: UnlockCatalog;
	record: Persistent;
	apply: (change: (record: Persistent) => Persistent) => void;
}

/** The catalog's lists against the play's record, with everything-at-once buttons first. */
function UnlockLists(handle: Handle<UnlockListsProps>) {
	return () => {
		let { catalog, record, apply } = handle.props;
		let read = catalog.lines.filter((key) => record.seen[key] !== undefined).length;
		return (
			<div mix={css({ display: "grid", gap: "8px" })}>
				<div mix={css(ROW)}>
					<Button
						type="button"
						size="sm"
						variant="outline"
						mix={on("click", () => apply((current) => unlockedPersistent(catalog, current)))}
					>
						Unlock everything
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						color="danger"
						mix={on("click", () => apply((current) => lockedPersistent(current)))}
					>
						Lock everything
					</Button>
				</div>
				<p data-list="lines">
					Lines read: {read}/{catalog.lines.length}{" "}
					<Button
						type="button"
						size="sm"
						variant="ghost"
						mix={on("click", () =>
							apply((current) => ({
								...current,
								seen: Object.fromEntries(
									catalog.lines.map((key) => [key, current.seen[key] ?? {}]),
								),
							})),
						)}
					>
						Mark all read
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						mix={on("click", () => apply((current) => ({ ...current, seen: {} })))}
					>
						Mark all unread
					</Button>
				</p>
				{UNLOCK_LISTS.map(([list, title]) => (
					<UnlockChecklist
						list={list}
						title={title}
						ids={catalog[list]}
						held={heldIds(record, list)}
						apply={apply}
					/>
				))}
			</div>
		);
	};
}

/** Props of {@link UnlockChecklist}. */
interface UnlockChecklistProps {
	list: UnlockList;
	title: string;
	ids: readonly string[];
	held: readonly string[];
	apply: UnlockListsProps["apply"];
}

/** One list as a disclosure of checkboxes, its summary counting what the record holds. */
function UnlockChecklist(handle: Handle<UnlockChecklistProps>) {
	return () => {
		let { list, title, ids, held, apply } = handle.props;
		let count = ids.filter((id) => held.includes(id)).length;
		/** Restarts with the list set to `next`. */
		let set = (next: string[]) => apply((current) => withIds(current, list, next));
		return (
			<details data-list={list}>
				<summary>
					{title} ({count}/{ids.length})
				</summary>
				<div mix={css({ display: "grid", gap: "4px", paddingBlock: "4px" })}>
					<div mix={css(ROW)}>
						<Button type="button" size="sm" variant="ghost" mix={on("click", () => set([...ids]))}>
							All
						</Button>
						<Button type="button" size="sm" variant="ghost" mix={on("click", () => set([]))}>
							None
						</Button>
					</div>
					{ids.length === 0 ? <p>The novel declares none.</p> : null}
					<div
						mix={css({
							display: "grid",
							gap: "2px",
							maxBlockSize: "12rem",
							overflow: "auto",
							fontFamily: "ui-monospace, monospace",
							fontSize: "12px",
						})}
					>
						{ids.map((id) => (
							<Checkbox
								key={id}
								value={id}
								checked={held.includes(id)}
								mix={on("change", (event) =>
									set(
										event.currentTarget.checked
											? [...held, id]
											: held.filter((each) => each !== id),
									),
								)}
							>
								{id}
							</Checkbox>
						))}
					</div>
				</div>
			</details>
		);
	};
}

/** The ids `record` holds for one list. */
function heldIds(record: Persistent, list: UnlockList): string[] {
	if (list === "characters") return record.introduced;
	if (list === "endings" || list === "chapters") return record[list];
	return record.unlocked[list];
}

/** A copy of `record` with one list replaced. */
function withIds(record: Persistent, list: UnlockList, ids: string[]): Persistent {
	if (list === "characters") return { ...record, introduced: ids };
	if (list === "endings" || list === "chapters") return { ...record, [list]: ids };
	return { ...record, unlocked: { ...record.unlocked, [list]: ids } };
}

/**
 * Every declared character with why the library counts them as met, or why not, read again
 * whenever the play's record changes once the reader asked for it.
 */
export function CastSection(handle: Handle<SectionProps>) {
	let wanted = false;
	/** The record last asked about, as JSON, since the play hands out a fresh copy on every read. */
	let asked: string | undefined;
	let cast: CastReport[] | undefined;

	/** Reads the library from `record`, unless a newer record was asked about meanwhile. */
	async function explain(record: Persistent, key: string): Promise<void> {
		let read = await handle.props.devtools.cast(record);
		if (handle.signal.aborted || asked !== key) return;
		cast = read;
		void handle.update();
	}

	return () => {
		let record = handle.props.devtools.persistent;
		let key = record === undefined ? undefined : JSON.stringify(record);
		if (wanted && record !== undefined && key !== undefined && key !== asked) {
			asked = key;
			void explain(record, key);
		}
		return (
			<Disclosure>
				<Disclosure.Trigger>Cast</Disclosure.Trigger>
				<Disclosure.Panel>
					<div mix={css({ display: "grid", gap: "8px" })}>
						{wanted ? null : (
							<Button
								type="button"
								size="sm"
								variant="outline"
								mix={on("click", () => {
									wanted = true;
									void handle.update();
								})}
							>
								Explain who is met
							</Button>
						)}
						{wanted && record === undefined ? <p>Waiting for the play to reach a line.</p> : null}
						{cast === undefined ? null : (
							<ul
								aria-label="Cast"
								mix={css({
									margin: 0,
									paddingInlineStart: "16px",
									maxBlockSize: "20rem",
									overflow: "auto",
								})}
							>
								{cast.map((character) => (
									<li
										key={character.id}
										data-character={character.id}
										data-met={String(character.met)}
									>
										<strong>{character.id}</strong> {character.met ? "met" : "not met"}
										{character.listed ? "" : " (unlisted)"}: {metReasons(character)}
									</li>
								))}
							</ul>
						)}
					</div>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/**
 * The reasons behind a character's `met`, in the order the library checks them.
 *
 * @returns Such as `introduced; speaks 3 read lines (first prologue:mika.hello); drawn as mika:smile`.
 */
export function metReasons(character: CastReport): string {
	let reasons: string[] = [];
	if (character.introduced) reasons.push("introduced");
	if (character.lines.length > 0) {
		reasons.push(
			`speaks ${character.lines.length} read line${character.lines.length === 1 ? "" : "s"} (first ${character.lines[0]})`,
		);
	}
	if (character.looks.length > 0) reasons.push(`drawn as ${character.looks.join(", ")}`);
	if (character.bios.length > 0) reasons.push(`bio: ${character.bios.join(", ")}`);
	return reasons.length === 0 ? "never introduced, heard or drawn" : reasons.join("; ");
}

/**
 * The linked player's own reactions, on demand: a toast of each kind it shows, its hover and
 * select sounds on the interface channel, full screen, and the title screen. A linked title
 * screen answers its sounds and full screen.
 */
export function PlayerSection(handle: Handle<SectionProps>) {
	return () => {
		let { devtools } = handle.props;
		let linked = devtools.linked;
		let playing = devtools.player !== undefined;
		let sounds = devtools.sounds;
		return (
			<Disclosure>
				<Disclosure.Trigger>Player</Disclosure.Trigger>
				<Disclosure.Panel>
					<div mix={css({ display: "grid", gap: "8px" })}>
						{linked ? null : <p>{UNLINKED}</p>}
						{devtools.title === undefined ? null : <p>{ON_TITLE}</p>}
						<div role="group" aria-label="Sample notifications" mix={css(ROW)}>
							{SAMPLE_KINDS.map((kind) => (
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={!playing}
									data-sample={kind}
									mix={on("click", () => void devtools.notify(kind))}
								>
									{SAMPLE_LABELS[kind]}
								</Button>
							))}
						</div>
						<div role="group" aria-label="Interface sounds" mix={css(ROW)}>
							{linked && sounds.length === 0 ? (
								<p>
									No interface sounds: pass <code>sounds</code> to the player.
								</p>
							) : null}
							{sounds.map((role) => (
								<Button
									type="button"
									size="sm"
									variant="ghost"
									data-sound={role}
									mix={on("click", () => void devtools.playSound(role))}
								>
									▶ {SOUND_LABELS[role]}
								</Button>
							))}
						</div>
						<div mix={css(ROW)}>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={!linked}
								mix={on("click", () => void devtools.toggleFullscreen())}
							>
								Toggle full screen
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={!playing}
								mix={on("click", () => void devtools.toTitle())}
							>
								Back to the title screen
							</Button>
						</div>
					</div>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}
