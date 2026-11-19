/**
 * Island suggesting people to mention while a message is written: typing `@` at the start of
 * a word in the composer opens a list above it, filtered as the handle is typed, and picking
 * someone writes `@handle`. It needs script; without it the field is plain text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { hstack, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, m, maxBs, minIs, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, truncate, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { floatingSurface } from "../styles/floating-surface.js";

import type { MentionMenuState } from "./mixins/mention-menu.js";
import type { MentionPerson } from "./utils/mention-query.js";

import { MENTION_INDEX_ATTRIBUTE, mentionMenu, mentionOptionId } from "./mixins/mention-menu.js";
import { mentionMatches } from "./utils/mention-query.js";

export type { MentionPerson, MentionQuery } from "./utils/mention-query.js";
export { mentionMatches, mentionQuery } from "./utils/mention-query.js";

/** How many people the list shows when `limit` is omitted. */
const DEFAULT_LIMIT = 6;

/** Prop types for {@link MentionMenu}. */
export namespace MentionMenu {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** Everyone who can be mentioned, in the order an empty query lists them. */
		people: MentionPerson[];
		/** The list's accessible name, and the line shown when nobody matches. */
		labels: { list: string; empty: string };
		/** The character that starts a mention. @default "@" */
		trigger?: string;
		/** The `id` of the `<textarea>` to watch; the `Composer.Input` of the island's form when omitted. */
		target?: string;
		/** How many people the list shows at once. @default 6 */
		limit?: number;
	};
}

/**
 * Renders the list as a manual popover anchored above the composer. While it is open the
 * field acts as its combobox: ArrowUp and ArrowDown move, Enter or Tab writes the active
 * person's handle, Escape closes, and Enter never sends the message.
 *
 * @example
 * <Composer method="post">
 * 	<Composer.Input name="body" aria-label="Message" />
 * 	<MentionMenu people={members} labels={{ list: "People", empty: "Nobody matches" }} />
 * </Composer>
 */
export const MentionMenu: EntryComponent<MentionMenu.Props> = clientEntry(
	"@sdxc/ui/chat/mention-menu#MentionMenu",
	function MentionMenu(handle: Handle<MentionMenu.Props>) {
		let menuId = `${handle.id}-mentions`;
		let listId = `${handle.id}-mention-list`;
		let state: MentionMenuState = { open: false, query: "", active: 0 };

		/** Renders the list the mixin reports, resolving once it is in the page. */
		function onChange(next: MentionMenuState) {
			state = next;
			return handle.update();
		}

		return () => {
			let { labels, people, target, trigger = "@", limit = DEFAULT_LIMIT } = handle.props;
			let { open, query, active } = state;
			let listed = open ? mentionMatches(people, query, limit) : [];
			return (
				<div
					id={menuId}
					popover="manual"
					data-slot="mention-menu"
					mix={[
						mentionMenu({ people, trigger, target, limit, listId, onChange }),
						floatingSurface(),
						m(0),
						p(1),
						raw({ position: "fixed", inset: "auto", boxSizing: "border-box" }),
						minIs("12rem"),
						maxBs("16rem"),
						raw({ overflowY: "auto" }),
					]}
				>
					<div role="listbox" id={listId} aria-label={labels.list}>
						{listed.map((person, index) => (
							<div
								key={person.id}
								role="option"
								id={mentionOptionId(listId, person)}
								aria-selected={index === active ? "true" : "false"}
								data-mention-handle={person.handle}
								{...{ [MENTION_INDEX_ATTRIBUTE]: String(index) }}
								mix={[
									hstack({ gap: 2, align: "center" }),
									pi(2),
									bs("2.5rem"),
									rounded("md"),
									cursor("pointer"),
									when('&[aria-selected="true"]', bg("neutral.bg-tint")),
								]}
							>
								<span
									aria-hidden="true"
									style={
										person.color === undefined
											? undefined
											: `background-color: ${person.color}; color: #fff`
									}
									mix={[
										hstack({ align: "center", justify: "center" }),
										is("1.75rem"),
										bs("1.75rem"),
										shrink(0),
										rounded("md"),
										bg("neutral.bg-tint"),
										fg("neutral.emphasis"),
										text("xs"),
										weight("semibold"),
									]}
								>
									{person.initials}
								</span>
								<span mix={[vstack({ gap: 0 }), raw({ minInlineSize: 0 })]}>
									<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis"), truncate()]}>
										{person.name}
									</span>
									<span mix={[text("xs"), fg("neutral.muted"), truncate()]}>
										{trigger}
										{person.handle}
										{person.detail === undefined ? null : ` · ${person.detail}`}
									</span>
								</span>
							</div>
						))}
					</div>
					{open && listed.length === 0 ? (
						<p role="status" mix={[m(0), p(2), text("sm"), fg("neutral.muted")]}>
							{labels.empty}
						</p>
					) : null}
				</div>
			);
		};
	},
);
