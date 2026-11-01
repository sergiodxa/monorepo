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

import type { HeadingLevel } from "../components/heading-scope.js";

import { HeadingScope, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { Keyboard } from "../components/keyboard.js";
import { Modal } from "../components/modal.js";

import type { Shortcuts } from "./behaviors/shortcuts.js";

import { shortcutAlternatives, shortcutGlyphs } from "./behaviors/shortcuts.js";
import { keyboardHelp } from "./mixins/keyboard-help.js";
import { ShortcutList } from "./shortcut-list.js";
import { mergeShortcutGroups } from "./utils/shortcut-groups.js";

/** The key that opens the sheet when none is given. */
const DEFAULT_SHORTCUT = "?";

/** A dialog opens over a page that already has its `<h1>`, so its title sits one below. */
const DEFAULT_LEVEL: HeadingLevel = 2;

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
		/**
		 * The title's heading level, its groups one below. The sheet reads no ambient heading
		 * scope, so server and browser render the same tags. @default 2
		 */
		level?: HeadingLevel;
	};
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
			let { id, labels, groups, shortcut, level = DEFAULT_LEVEL } = handle.props;
			let GroupTitle = TAG_BY_LEVEL[Math.min(level + 1, 6) as HeadingLevel];
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
						<HeadingScope level={level}>
							<Modal.Title id={titleId}>{labels.title}</Modal.Title>
						</HeadingScope>
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
								<GroupTitle mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
									{group.title}
								</GroupTitle>
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
