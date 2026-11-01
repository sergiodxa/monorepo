/**
 * The keyboard cheat sheet `?` opens: a 640px dialog listing every shortcut on the page in
 * titled groups, two columns wide where it fits. The server renders the groups it is given;
 * in the browser it adds whatever the page's shortcut registry holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { contents, flex, gap, grid, gridTemplate, items, justify } from "@sdxc/u/layout";
import { m, maxIs, mbs } from "@sdxc/u/size";
import { pretty, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Keyboard } from "../components/keyboard.js";
import { Modal } from "../components/modal.js";

import type { Shortcuts } from "./behaviors/shortcuts.js";

import { shortcutAlternatives, shortcutGlyphs } from "./behaviors/shortcuts.js";
import { keyboardHelp } from "./mixins/keyboard-help.js";
import { ShortcutList } from "./shortcut-list.js";

/** The key that opens the sheet when none is given. */
const DEFAULT_SHORTCUT = "?";

/**
 * Types for {@link KeyboardHelp}. Declared as `type`s, since the props cross into the
 * browser with the island and are checked as serializable.
 */
export namespace KeyboardHelp {
	/** One row: the keys, or alternatives, and what they do. */
	export type Shortcut = {
		/** A combo or `g`+key sequence, or several as alternatives, e.g. `["j", "arrowdown"]`. */
		keys: string | string[];
		label: string;
	};

	/** A titled group of rows. */
	export type Group = { title: string; shortcuts: Shortcut[] };

	/** Every string the sheet shows. */
	export type Labels = {
		/** The dialog's heading, e.g. "Keyboard shortcuts". */
		title: string;
		description?: string;
		/** Names the close control. */
		close: string;
		/** Joins alternatives, e.g. "or". */
		or: string;
		/** What the sheet's own key lists as, e.g. "Show keyboard shortcuts". */
		open: string;
		/** The group the sheet's own key lists under, e.g. "General". */
		general: string;
		/** The heading for registered shortcuts that name no group. */
		other: string;
	};

	/** Props for {@link KeyboardHelp}. */
	export type Props = {
		/** The dialog's `id`, which a button's `commandfor` names to open it. */
		id: string;
		labels: Labels;
		/** Groups rendered on the server, before the page's registry is read. */
		groups?: Group[];
		/** The key that opens the sheet. @default "?" */
		shortcut?: string;
	};
}

/**
 * Merges the server's groups with the registry's rows, keeping the server's order and appending
 * rows and groups it lacks; a row already listed with the same keys and label appears once.
 *
 * @param groups The groups passed as props.
 * @param entries The registry's rows.
 * @param other The heading for rows that name no group.
 * @returns The groups the sheet shows, empty groups dropped.
 */
export function mergeShortcutGroups(
	groups: KeyboardHelp.Group[],
	entries: Shortcuts.Entry[],
	other: string,
): KeyboardHelp.Group[] {
	let merged = groups.map((group) => ({ title: group.title, shortcuts: [...group.shortcuts] }));
	let seen = new Set(
		merged.flatMap((group) =>
			group.shortcuts.map((row) => `${shortcutAlternatives(row.keys).join(",")}|${row.label}`),
		),
	);

	for (let entry of entries) {
		let id = `${entry.keys.join(",")}|${entry.label}`;
		if (seen.has(id)) continue;
		seen.add(id);
		let title = entry.group ?? other;
		let group = merged.find((candidate) => candidate.title === title);
		if (group === undefined) {
			group = { title, shortcuts: [] };
			merged.push(group);
		}
		group.shortcuts.push({ keys: entry.keys, label: entry.label });
	}

	return merged.filter((group) => group.shortcuts.length > 0);
}

/**
 * Renders the sheet: a modal dialog with its close control, heading, and one {@link ShortcutList}
 * per group in columns at least 16rem wide. Open it with its key, or from a button with
 * `commandfor={id} command="show-modal"`; load `@sdxc/ui/app/keyboard-help` in the browser entry.
 *
 * @example <KeyboardHelp id="keys" labels={labels} groups={[{ title: "Navigation", shortcuts: [{ keys: "g m", label: "Go to Monitors" }] }]} />
 */
export const KeyboardHelp: EntryComponent<KeyboardHelp.Props> = clientEntry(
	"@sdxc/ui/app/keyboard-help#KeyboardHelp",
	function KeyboardHelp(handle: Handle<KeyboardHelp.Props>) {
		let entries: Shortcuts.Entry[] = [];
		let apple = true;

		/** Takes the registry's rows, re-rendering only when they or the platform changed. */
		let onChange = (next: Shortcuts.Entry[], nextApple: boolean) => {
			if (nextApple === apple && JSON.stringify(next) === JSON.stringify(entries)) return;
			entries = next;
			apple = nextApple;
			void handle.update();
		};

		return () => {
			let { id, labels, groups, shortcut } = handle.props;
			let titleId = `${id}-title`;
			let shown = mergeShortcutGroups(groups ?? [], entries, labels.other);

			return (
				<Modal
					id={id}
					aria-labelledby={titleId}
					closedby="any"
					data-slot="keyboard-help"
					mix={[
						maxIs("var(--ui-app-keyboard-help-width, 40rem)"),
						keyboardHelp({
							shortcut: shortcut ?? DEFAULT_SHORTCUT,
							label: labels.open,
							group: labels.general,
							onChange,
						}),
					]}
				>
					<Modal.Close commandfor={id} aria-label={labels.close} />
					<Modal.Header>
						<Modal.Title id={titleId}>{labels.title}</Modal.Title>
						{labels.description ? (
							<Modal.Description>{labels.description}</Modal.Description>
						) : null}
					</Modal.Header>

					<div
						mix={[
							grid(),
							gap(6, 8),
							items("start"),
							gridTemplate({ columns: "repeat(auto-fit, minmax(min(16rem, 100%), 1fr))" }),
						]}
					>
						{shown.map((group) => (
							<section key={group.title} data-slot="keyboard-help-group">
								<h3 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
									{group.title}
								</h3>
								<ShortcutList mix={[m(0), mbs(3)]}>
									{group.shortcuts.map((row) => (
										<div
											key={`${shortcutAlternatives(row.keys).join(",")}|${row.label}`}
											data-slot="shortcut"
											mix={[contents()]}
										>
											<dt mix={[text("sm"), fg("neutral"), pretty()]}>{row.label}</dt>
											<dd mix={[m(0), flex(), gap(1), items("center"), justify("end"), text("xs")]}>
												{shortcutAlternatives(row.keys).map((alternative, index) => (
													<span key={alternative} mix={[flex(), gap(1), items("center")]}>
														{index > 0 ? (
															<span mix={[fg("neutral.muted")]}>{labels.or}</span>
														) : null}
														{shortcutGlyphs(alternative, apple).map((glyph, cap) => (
															<Keyboard key={`${index}-${cap}`} mix={[m(0), weight("medium")]}>
																{glyph}
															</Keyboard>
														))}
													</span>
												))}
											</dd>
										</div>
									))}
								</ShortcutList>
							</section>
						))}
					</div>
				</Modal>
			);
		};
	},
);
