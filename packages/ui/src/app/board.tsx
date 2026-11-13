/**
 * A kanban board: columns of cards a person drags from one column to another. Each card owns
 * a move form, so a drop is a plain post the server answers, and the same form takes the
 * card's own menu, which moves it without script, by keyboard or on a touch screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { attrs, clientEntry } from "remix/component";

import {
	SORTABLE_ACTIVE_ATTRIBUTE,
	SORTABLE_ATTRIBUTE,
	SORTABLE_COUNT_ATTRIBUTE,
	SORTABLE_DRAGGING_ATTRIBUTE,
	SORTABLE_FIELD_ATTRIBUTE,
	SORTABLE_FORM_ATTRIBUTE,
	SORTABLE_ITEM_ATTRIBUTE,
	SORTABLE_ITEMS_ATTRIBUTE,
	SORTABLE_LIST_ATTRIBUTE,
	SORTABLE_POSITION_ATTRIBUTE,
	SORTABLE_SCROLLER_ATTRIBUTE,
	SORTABLE_STATUS_ATTRIBUTE,
	SORTABLE_TARGET_ATTRIBUTE,
	SORTABLE_TITLE_ATTRIBUTE,
	sortable,
} from "../mixins/sortable.js";

/** Container the board names, so its columns answer the board's width rather than the page's. */
const BOARD_CONTAINER = "ui-board";

/**
 * The id of a card's move form, for a menu row that moves the card by submitting it with the
 * column's value as its own `name` and `value`.
 *
 * @param board The board's id.
 * @param card The card's value.
 * @returns The form's id.
 * @example <Menu.Item type="submit" form={boardMoveFormId("web", "WEB-12")} name="status" value="done">Done</Menu.Item>
 */
export function boardMoveFormId(board: string, card: string): string {
	return `${board}-move-${card}`;
}

/** Prop types for {@link Board}, {@link Board.Column} and {@link Board.Card}. */
export namespace Board {
	/** Props accepted by {@link Board}. */
	export interface Props extends Omit<TagProps<"div">, "id" | "children"> {
		/** The board's id, which each card's move form id starts with. */
		id: string;
		/** The board's accessible name, such as "Web issues by status". */
		label: string;
		/** What a keyboard move announces, such as "Moved to {column}". */
		labels?: Labels;
		/** {@link Board.Column}s, in order. */
		children: RemixNode;
	}

	/** Strings the board announces. */
	export interface Labels {
		/** Read after a keyboard move, with `{column}` where the column's title goes. */
		moved: string;
	}

	/** Context a board hands its cards. */
	export interface Context {
		id: string;
	}

	/** Props accepted by {@link Board.Column}. */
	export interface ColumnProps extends Omit<TagProps<"section">, "title" | "children"> {
		/** The value a card dropped here posts, such as a status id. */
		value: string;
		title: string;
		/** A 16px glyph before the title. */
		icon?: RemixNode;
		/** The number of cards, which a drop keeps current until the server answers. */
		count?: number;
		/** Controls at the header's end, such as an "Add issue" link. */
		actions?: RemixNode;
		/** What an empty column says, such as "No issues". */
		empty?: RemixNode;
		/** {@link Board.Card}s. */
		children?: RemixNode;
	}

	/** Where a card's move posts: the form's address, the field the column fills, and extras. */
	export interface Move {
		action: string;
		/**
		 * The field a drop sends the column's value in, such as `"status"`. It comes after
		 * `fields`, so a reader of the post takes the field's last value.
		 */
		name: string;
		/**
		 * The field a move sends the value of the card it lands before in, empty when it lands
		 * last, such as `"before"`. With it, a drag places the card where the pointer is, a card
		 * moves within its column, and Shift+ArrowUp/Down reorder; without it, a moved card lands
		 * at the top of its new column.
		 */
		position?: string;
		/**
		 * The named `<Frame>` a move loads into, so a drop or a menu pick reloads only that frame
		 * rather than the page, such as the board's own.
		 */
		target?: string;
		/** Hidden fields posted with every move, such as the page to return to. */
		fields?: Record<string, string>;
	}

	/** Props accepted by {@link Board.Card}. */
	export interface CardProps extends Omit<TagProps<"li">, "children"> {
		/** The card's value, such as a record id, unique on the board. */
		value: string;
		/** Where a drop posts; a card without one can be read but not moved. */
		move?: Move;
		/** The card's content: usually a link to the record that fills the card. */
		children: RemixNode;
	}
}

/**
 * Client island: an invisible marker carrying the board's pointer drag and keyboard moves, so its columns
 * and cards stay server HTML. Loads from `@sdxc/ui/app/board#BoardDrag`.
 */
export const BoardDrag: EntryComponent<BoardDragProps> = clientEntry(
	"@sdxc/ui/app/board#BoardDrag",
	function BoardDrag(handle) {
		return () => (
			<span
				hidden
				data-slot="board-drag"
				mix={[sortable({ moved: handle.props.moved?.replaceAll("{column}", "{list}") })]}
			/>
		);
	},
);

/**
 * Props {@link BoardDrag} serializes into the page, which is why they are a `type`:
 * `SerializableProps` rejects an interface.
 */
export type BoardDragProps = {
	/** What a keyboard move announces, with `{column}` where the column's title goes. */
	moved?: string;
};

/**
 * Renders the board: columns `--ui-board-column-width` (18rem) wide in one positioned box that
 * clips and scrolls everything in it, so the page never grows to its width; given a height, it
 * fills it under sticky column headers. Sideways scrolling snaps column by column, and a
 * phone-narrow board shows one column and a sliver of the next.
 *
 * @example
 * <Board id="web" label="Web issues by status">
 * 	<Board.Column value="todo" title="Todo" count={2}>
 * 		<Board.Card value="WEB-12" move={{ action: "/issues/WEB-12", name: "status" }}>
 * 			<a href="/issues/WEB-12">Fix the cart badge</a>
 * 		</Board.Card>
 * 	</Board.Column>
 * </Board>
 */
export function Board(handle: Handle<Board.Props, Board.Context>) {
	return () => {
		let { id, label, labels, children, mix, ...rest } = handle.props;
		handle.context.set({ id });
		return (
			<div
				{...rest}
				id={id}
				role="region"
				aria-label={label}
				data-slot="board"
				mix={mergeMix(
					[
						attrs({ [SORTABLE_ATTRIBUTE]: "" }),
						raw({
							container: `${BOARD_CONTAINER} / inline-size`,
							display: "flex",
							flexDirection: "column",
							minInlineSize: 0,
							minBlockSize: 0,
							[`&[${SORTABLE_ACTIVE_ATTRIBUTE}]`]: { cursor: "grabbing", userSelect: "none" },
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="board-columns"
					mix={[
						attrs({ [SORTABLE_SCROLLER_ATTRIBUTE]: "" }),
						raw({
							position: "relative",
							display: "flex",
							alignItems: "stretch",
							flex: "1 1 auto",
							minBlockSize: 0,
							gap: "0.75rem",
							overflow: "auto",
							overscrollBehavior: "contain",
							paddingBlockEnd: "0.5rem",
							scrollPaddingInline: "0.5rem",
							scrollSnapType: "x mandatory",
							[`[${SORTABLE_ACTIVE_ATTRIBUTE}] > &`]: { scrollSnapType: "none" },
						}),
					]}
				>
					{children}
				</div>
				<span
					data-slot="board-status"
					role="status"
					aria-live="polite"
					mix={[attrs({ [SORTABLE_STATUS_ATTRIBUTE]: "" }), visuallyHidden()]}
				/>
				<BoardDrag moved={labels?.moved} />
			</div>
		);
	};
}

/**
 * One column: its header (glyph, title, count, actions) over its cards. While a dragged card
 * hovers it, the column takes a brand tint and ring.
 */
Board.Column = function BoardColumn(handle: Handle<Board.ColumnProps>) {
	return () => {
		let { value, title, icon, count, actions, empty, children, mix, ...rest } = handle.props;
		let headingId = `board-column-${value}`;
		return (
			<section
				{...rest}
				aria-labelledby={headingId}
				data-slot="board-column"
				mix={mergeMix(
					[
						attrs({ [SORTABLE_LIST_ATTRIBUTE]: value }),
						raw({
							display: "flex",
							flexDirection: "column",
							flex: "0 0 var(--ui-board-column-width, 18rem)",
							minInlineSize: 0,
							borderRadius: "var(--ui-radius-lg, 0.5rem)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							outline: "2px solid transparent",
							outlineOffset: "-2px",
							transition: "background-color 120ms, outline-color 120ms",
							scrollSnapAlign: "start",
							[`@container ${BOARD_CONTAINER} (width < 40rem)`]: { flexBasis: "85%" },
						}),
						when(
							`&[${SORTABLE_TARGET_ATTRIBUTE}]`,
							raw({
								outlineColor: "var(--ui-brand-ring)",
								backgroundColor:
									"color-mix(in oklch, var(--ui-neutral-bg-tint), var(--ui-brand-bg-solid) 10%)",
							}),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				<header
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: 0,
							zIndex: 1,
							backgroundColor: "inherit",
							borderStartStartRadius: "inherit",
							borderStartEndRadius: "inherit",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							minBlockSize: "2.5rem",
							paddingInline: "0.75rem",
							fontSize: "0.875rem",
							lineHeight: "1.25rem",
							"& > svg, & > [data-slot='board-icon'] > svg": {
								inlineSize: "1rem",
								blockSize: "1rem",
								flexShrink: "0",
							},
						}),
					]}
				>
					{iife(() => {
						if (!icon) return null;
						return (
							<span
								data-slot="board-icon"
								aria-hidden="true"
								mix={[raw({ display: "inline-flex" })]}
							>
								{icon}
							</span>
						);
					})}
					<h3
						id={headingId}
						mix={[
							attrs({ [SORTABLE_TITLE_ATTRIBUTE]: "" }),
							raw({
								margin: "0",
								fontSize: "inherit",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}),
						]}
					>
						{title}
					</h3>
					{iife(() => {
						if (count === undefined) return null;
						return (
							<span
								data-slot="board-count"
								mix={[
									attrs({ [SORTABLE_COUNT_ATTRIBUTE]: "" }),
									raw({ color: "var(--ui-neutral-fg-muted)", fontVariantNumeric: "tabular-nums" }),
								]}
							>
								{count}
							</span>
						);
					})}
					{iife(() => {
						if (!actions) return null;
						return (
							<span
								mix={[raw({ marginInlineStart: "auto", display: "inline-flex", gap: "0.25rem" })]}
							>
								{actions}
							</span>
						);
					})}
				</header>
				{iife(() => {
					if (!empty) return null;
					return (
						<p
							data-slot="board-empty"
							mix={[
								raw({
									display: "none",
									margin: "0 0.5rem 0.5rem",
									blockSize: "3.5rem",
									boxSizing: "border-box",
									paddingBlock: "1.125rem",
									textAlign: "center",
									fontSize: "0.8125rem",
									lineHeight: "1.25rem",
									color: "var(--ui-neutral-fg-muted)",
									border: "1px dashed var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-md, 0.375rem)",
									pointerEvents: "none",
								}),
								when(
									"[data-slot='board-column']:has(> [data-slot='board-cards']:empty) > &",
									raw({ display: "block" }),
								),
							]}
						>
							{empty}
						</p>
					);
				})}
				<ul
					data-slot="board-cards"
					aria-labelledby={headingId}
					mix={[
						attrs({ [SORTABLE_ITEMS_ATTRIBUTE]: "" }),
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.5rem",
							flex: "1 1 auto",
							margin: "0",
							padding: "0 0.5rem 0.5rem",
							listStyle: "none",
							minBlockSize: "4rem",
						}),
					]}
				>
					{children}
				</ul>
			</section>
		);
	};
};

/**
 * One card: a raised surface holding the consumer's content, grabbable by a mouse or pen, and
 * a hidden move form. A drop appends the column's field after the form's own; a menu row
 * submitting the form sends its value as the submitter, also last, so a reader takes the last.
 */
Board.Card = function BoardCard(handle: Handle<Board.CardProps>) {
	return () => {
		let { value, move, children, mix, ...rest } = handle.props;
		let board = handle.context.get(Board);
		return (
			<li
				{...rest}
				data-slot="board-card"
				data-rmx-key={value}
				mix={mergeMix(
					[
						attrs({ [SORTABLE_ITEM_ATTRIBUTE]: value }),
						raw({
							position: "relative",
							padding: "0.625rem 0.75rem",
							borderRadius: "var(--ui-radius-md, 0.375rem)",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-surface-raised, var(--ui-bg, Canvas))",
							boxShadow: "0 1px 2px rgb(0 0 0 / 0.04)",
							cursor: move ? "grab" : "auto",
							transition: "opacity 120ms, border-color 120ms",
						}),
						when(
							"&:hover",
							raw({ borderColor: "var(--ui-neutral-border-emphasis, var(--ui-neutral-fg-muted))" }),
						),
						when(`&[${SORTABLE_DRAGGING_ATTRIBUTE}]`, raw({ opacity: "0.35" })),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				{children}
				{iife(() => {
					if (!move) return null;
					return (
						<form
							id={boardMoveFormId(board.id, value)}
							method="post"
							action={move.action}
							data-rmx-target={move.target}
							hidden
							mix={[
								attrs({
									[SORTABLE_FORM_ATTRIBUTE]: value,
									[SORTABLE_FIELD_ATTRIBUTE]: move.name,
									[SORTABLE_POSITION_ATTRIBUTE]: move.position,
								}),
							]}
						>
							{Object.entries(move.fields ?? {}).map(([name, field]) => (
								<input type="hidden" name={name} value={field} />
							))}
						</form>
					);
				})}
			</li>
		);
	};
};
