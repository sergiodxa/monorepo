/**
 * The mark at the head of a post's row, which is what says whether it has been read and
 * what changes it. A form rather than a link, since following it changes what the reader
 * has read, and a link is what a prefetcher and a mail scanner follow on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleCheckIcon, CircleIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flex, shrink } from "@sdxc/u/layout";
import { bs, is, pb, pi } from "@sdxc/u/size";
import { Button } from "@sdxc/ui";
import { clientEntry, on, ref } from "remix/component";

import { SIDEBAR_FEEDS_FRAME } from "~/resources/components/sidebar-frame";

/**
 * The header this control sends when it has already moved the post itself. The answer is
 * then the outcome and nothing else: the reader is looking at the page a redirect would
 * have sent them to, further down it than the server has any way of knowing.
 */
export const READ_IN_PLACE_HEADER = "x-reader-in-place";

/**
 * The attribute the row wears while its post has been read, which is what the row's own
 * rules colour its title and its words by.
 */
const ROW_READ = "data-read";

/**
 * Stamped on a title this mark has taken the reporting of over, so a later render finds
 * the same anchor: it is looked for by its `ping` or by this, and the one is swapped for
 * the other exactly once.
 */
const TITLE_TAKEN = "data-marks-read";

/** Edge of the mark, sized to the label a small button would have carried instead. */
const ICON_SIZE = 16;

/**
 * How far sideways a drag has to travel before it counts as a swipe, in CSS pixels. Below
 * it the row springs back, so a gesture is previewed and abandonable rather than decided
 * at the moment a finger lands.
 */
const SWIPE_THRESHOLD = 64;

/**
 * The widest the row is carried while a finger is on it. The travel is a preview of the
 * move rather than the move itself, so it stops well short of the row leaving the screen.
 */
const SWIPE_TRAVEL = 96;

/** Where the phone-width gesture is on, which is the same measure a row reflows at. */
const PHONE_ROW = "(max-width: 33.999rem)";

/** Edge of the square the mark sits in, which is the tallest thing on a row. */
const TOGGLE_SIZE = "1.75rem";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's props
 * are checked against. Kept to what one row cannot work out for itself, since a queue
 * scrolled several pages deep carries hundreds of these.
 */
export type ReadToggleProps = {
	/** Where the submission goes, which names the post. */
	action: string;
	isRead: boolean;
	/** The page a submission without script returns to, which is the page being rendered. */
	returnTo: string;
	/** What the control is called in each of its two states, and when it has just failed. */
	markRead: string;
	markUnread: string;
	failed: string;
};

/**
 * The mark the control wears, which is one glyph of the app's icon set so every mark on a
 * page belongs together.
 */
function ReadMark(handle: Handle<{ isRead: boolean }>) {
	return () => {
		let { isRead } = handle.props;

		return isRead ? <CircleCheckIcon size={ICON_SIZE} /> : <CircleIcon size={ICON_SIZE} />;
	};
}

export const ReadToggle = clientEntry(
	import.meta.url,
	function ReadToggle(handle: Handle<ReadToggleProps>) {
		let isRead = handle.props.isRead;

		/** The row this mark heads, which wears the state the two of them share. */
		let row: Element | null = null;

		/** Set when the server refused the last move, which the mark says in the open. */
		let hasFailed = false;

		/**
		 * Which move is the reader's latest, so a slow answer to one they have already changed
		 * their mind about cannot put the mark back to something they did not ask for.
		 */
		let latest = 0;

		/**
		 * Moves the post, showing the move first. A reader ticking their way down a queue is
		 * doing it faster than a round trip, and a mark that waits for one lags behind the hand
		 * moving it; a move the server refuses is put back, and says so.
		 */
		/** Shows the post as read or unread, here and in the row around this. */
		function show(next: boolean, failed: boolean) {
			isRead = next;
			hasFailed = failed;

			if (next) row?.setAttribute(ROW_READ, "");
			else row?.removeAttribute(ROW_READ);

			void handle.update();
		}

		async function move(next: boolean) {
			let previous = isRead;
			let token = ++latest;

			show(next, false);

			try {
				let response = await fetch(handle.props.action, {
					method: "POST",
					credentials: "same-origin",
					headers: { [READ_IN_PLACE_HEADER]: "1" },
					body: new URLSearchParams({ read: String(next) }),
				});

				if (!response.ok) throw new Error(`Marking a post answered ${response.status}`);

				/**
				 * The sidebar counts this post among its feed's unread, so the band holding those
				 * counts is drawn again now that the server has recorded the move — after it
				 * rather than alongside it, since a refused move is one the counts never had.
				 */
				if (token === latest) await handle.frames.get(SIDEBAR_FEEDS_FRAME)?.reload();
			} catch (error) {
				if (token !== latest) return;

				show(previous, true);
				console.error("A post could not be marked", error);
			}
		}

		/**
		 * Opening a post reads it, so the title moves this mark as the mark itself would. The
		 * title carries a `ping`, which is how a browser with no script running tells the
		 * server the post was opened.
		 */
		/**
		 * Carries the row with the finger, or puts it back. The travel is written onto the
		 * element rather than declared, because the distance is whatever the finger has
		 * covered; a reader who asked for less motion is given none of it, and the toggle
		 */
		function travel(distance: number) {
			if (!(row instanceof HTMLElement)) return;
			if (!allowsMotion()) return;

			row.style.transform = distance === 0 ? "" : `translateX(${distance}px)`;
			row.style.transition = distance === 0 ? "transform 150ms ease-out" : "";
		}

		/** Whether this reader asked to be moved about, which the travel is the whole of here. */
		function allowsMotion(): boolean {
			return globalThis.matchMedia?.("(prefers-reduced-motion: no-preference)").matches ?? false;
		}

		/**
		 * A horizontal swipe on the row, which toggles the post exactly as the mark does. The
		 * row declares `touch-action: pan-y`, so the browser keeps every vertical movement for
		 * its own scrolling and this only ever sees the axis it asked for — which is more rel
		 */
		function watchSwipe(node: Element, signal: AbortSignal) {
			let start: { id: number; x: number } | null = null;

			node.addEventListener(
				"pointerdown",
				(event) => {
					let pointer = event as PointerEvent;

					/**
					 * A finger on a phone, which is the whole of where this is offered: a pointer
					 * that hovers has the mark beside it and the row's own reach, and a wide row
					 * has nowhere to travel to.
					 */
					if (pointer.pointerType === "mouse") return;
					if (!globalThis.matchMedia?.(PHONE_ROW).matches) return;

					start = { id: pointer.pointerId, x: pointer.clientX };
				},
				{ signal },
			);

			node.addEventListener(
				"pointermove",
				(event) => {
					let pointer = event as PointerEvent;
					if (start === null || pointer.pointerId !== start.id) return;

					let distance = pointer.clientX - start.x;
					travel(Math.max(-SWIPE_TRAVEL, Math.min(SWIPE_TRAVEL, distance)));
				},
				{ signal },
			);

			function end(event: Event) {
				let pointer = event as PointerEvent;
				if (start === null || pointer.pointerId !== start.id) return;

				let distance = pointer.clientX - start.x;
				start = null;
				travel(0);

				if (Math.abs(distance) >= SWIPE_THRESHOLD) void move(!isRead);
			}

			node.addEventListener("pointerup", end, { signal });
			node.addEventListener("pointercancel", end, { signal });
		}

		let watchTitle = ref((node, signal) => {
			row = node.closest("li");

			if (row) watchSwipe(row, signal);

			let title = row?.querySelector(`a[ping], a[${TITLE_TAKEN}]`);
			if (!title) return;

			title.removeAttribute("ping");
			title.setAttribute(TITLE_TAKEN, "");

			title.addEventListener(
				"click",
				() => {
					if (!isRead) void move(true);
				},
				{ signal },
			);

			signal.addEventListener("abort", () => (row = null), { once: true });
		});

		return () => {
			let label = hasFailed
				? handle.props.failed
				: isRead
					? handle.props.markUnread
					: handle.props.markRead;

			return (
				<form
					method="post"
					action={handle.props.action}
					mix={[
						shrink(),
						flex(),
						watchTitle,
						on<HTMLFormElement>("submit", (event) => {
							event.preventDefault();
							void move(!isRead);
						}),
					]}
				>
					<input type="hidden" name="returnTo" value={handle.props.returnTo} />
					<input type="hidden" name="read" value={isRead ? "false" : "true"} />

					{/**
					 * A square box in place of the padding a worded button carries, so one glyph
					 * centres in it rather than sitting in a pill.
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
							 * The colour the row's title wears, so the two halves of a row say one thing
							 * rather than sitting next to each other saying two.
							 */
							!hasFailed && fg(isRead ? "neutral" : "brand"),
						]}
					>
						<ReadMark isRead={isRead} />
					</Button>
				</form>
			);
		};
	},
);

export default ReadToggle;
