/**
 * The mark at the end of a post's row that keeps it, and the one that stops keeping it.
 *
 * A kept post is exempt from every rule that deletes one, so this is the only control in
 * the app whose answer is "never mind what any of that says". It is a form rather than a
 * link, since following it changes what the reader keeps, and a link is what a prefetcher
 * and a mail scanner follow on their own. Without script it posts and the server answers
 * with the page again, which is the whole of the behaviour.
 *
 * With script it is the row that changes rather than the page, for the reason the
 * mark-read control is: a reader eight pages into their queue keeps those eight pages and
 * the place they had scrolled to.
 *
 * The shelf has a limit and it refuses rather than making room, so this control has a
 * refusal to say that the mark-read one does not: a full shelf is told to the reader in
 * the label, where they read it and go and unsave something.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { BookmarkCheckIcon, BookmarkIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flex, shrink } from "@sdxc/u/layout";
import { bs, is, pb, pi } from "@sdxc/u/size";
import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/**
 * The header this control sends when it has already moved the post itself, which is what
 * asks the route for the outcome alone rather than for the page a redirect would send.
 */
export const SAVE_IN_PLACE_HEADER = "x-reader-save-in-place";

/** The status a refused save answers an in-place submission with, which is a full shelf. */
export const SHELF_FULL_STATUS = 409;

/** Edge of the mark, sized to the label a small button would have carried instead. */
const ICON_SIZE = 16;

/** Edge of the square the mark sits in, which is what a row's other mark takes. */
const TOGGLE_SIZE = "1.75rem";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's props
 * are checked against.
 *
 * Kept to what one row cannot work out for itself, since a queue scrolled several pages
 * deep carries hundreds of these.
 */
export type SaveToggleProps = {
	/** Where the submission goes, which names the post. */
	action: string;
	isSaved: boolean;
	/** The page a submission without script returns to, which is the page being rendered. */
	returnTo: string;
	/** What the control is called in each of its two states, and when it has just failed. */
	save: string;
	unsave: string;
	failed: string;
	/** What it says instead when the save was refused for want of room. */
	full: string;
};

/**
 * The mark the control wears, which is one glyph of the app's icon set so every mark on a
 * page belongs together. An empty bookmark for a post that is not kept and a ticked one
 * for a post that is, so the two differ in outline rather than in shade alone.
 */
function SaveMark(handle: Handle<{ isSaved: boolean }>) {
	return () => {
		let { isSaved } = handle.props;

		return isSaved ? <BookmarkCheckIcon size={ICON_SIZE} /> : <BookmarkIcon size={ICON_SIZE} />;
	};
}

export const SaveToggle = clientEntry(
	"/resources/components/save-toggle.tsx#SaveToggle",
	function SaveToggle(handle: Handle<SaveToggleProps>) {
		let isSaved = handle.props.isSaved;

		/** Set when the last move was refused, which the mark says in the open. */
		let hasFailed = false;

		/** Set when the refusal was a full shelf, which the reader is told what to do about. */
		let isFull = false;

		/**
		 * Which move is the reader's latest, so a slow answer to one they have already changed
		 * their mind about cannot put the mark back to something they did not ask for.
		 */
		let latest = 0;

		/** Shows the post as kept or not kept, and says what the last answer was. */
		function show(next: boolean, failed: boolean, full: boolean) {
			isSaved = next;
			hasFailed = failed;
			isFull = full;

			void handle.update();
		}

		/**
		 * Keeps the post, showing it kept first: a hand moving down a list is faster than a
		 * round trip, and a mark that waits for one lags behind it. A move the server refuses
		 * is put back, and says why — a full shelf is a different sentence from a failure,
		 * because the reader can do something about it.
		 */
		async function move(next: boolean) {
			let previous = isSaved;
			let token = ++latest;

			show(next, false, false);

			try {
				let response = await fetch(handle.props.action, {
					method: "POST",
					credentials: "same-origin",
					headers: { [SAVE_IN_PLACE_HEADER]: "1" },
					body: new URLSearchParams({ saved: String(next) }),
				});

				if (response.status === SHELF_FULL_STATUS) {
					if (token === latest) show(previous, true, true);
					return;
				}

				if (!response.ok) throw new Error(`Keeping a post answered ${response.status}`);
			} catch (error) {
				if (token !== latest) return;

				show(previous, true, false);
				console.error("A post could not be kept", error);
			}
		}

		return () => {
			let label = isFull
				? handle.props.full
				: hasFailed
					? handle.props.failed
					: isSaved
						? handle.props.unsave
						: handle.props.save;

			return (
				<form
					method="post"
					action={handle.props.action}
					mix={[
						shrink(),
						flex(),
						on<HTMLFormElement>("submit", (event) => {
							event.preventDefault();
							void move(!isSaved);
						}),
					]}
				>
					<input type="hidden" name="returnTo" value={handle.props.returnTo} />
					<input type="hidden" name="saved" value={isSaved ? "false" : "true"} />

					{/**
					 * A square box in place of the padding a worded button carries, so one glyph
					 * centres in it rather than sitting in a pill.
					 *
					 * The mark is the whole control, so `label` is what names it: it reaches a screen
					 * reader through `aria-label` and a pointer through the native tooltip `title`
					 * gives. A refusal is said in both, so a reader who saw the mark flip back is told
					 * why rather than left to wonder.
					 */}
					<Button
						type="submit"
						color={hasFailed ? "danger" : "neutral"}
						variant="ghost"
						size="sm"
						aria-label={label}
						title={label}
						mix={[
							pi(0),
							pb(0),
							is(TOGGLE_SIZE),
							bs(TOGGLE_SIZE),
							/**
							 * The glyph is what carries the state — an empty bookmark against a ticked one
							 * — because a colour is lost to a reader who cannot tell two of them apart and
							 * to anybody outdoors with the brightness down; the colour agrees with it.
							 */
							!hasFailed && fg(isSaved ? "brand" : "neutral"),
						]}
					>
						<SaveMark isSaved={isSaved} />
					</Button>
				</form>
			);
		};
	},
);

export default SaveToggle;
