/**
 * Live preview for `Board`: a small team's issues in three columns, each card a link with its
 * own move form, so a mouse drags a card to another column and the drop posts that column.
 * The preview's cards carry no move form, so a drop moves the card in place and posts nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Board } from "@sdxc/ui/app/board";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<Board id="web" label="Issues by status">
	<Board.Column value="todo" title="Todo" count={2} empty="No issues">
		<Board.Card value="WEB-12" move={{ action: "/issues/WEB-12", name: "status" }}>
			<a href="/issues/WEB-12">Fix the cart badge</a>
		</Board.Card>
		<Board.Card value="WEB-14" move={{ action: "/issues/WEB-14", name: "status" }}>
			<a href="/issues/WEB-14">Keep the country on reset</a>
		</Board.Card>
	</Board.Column>
	<Board.Column value="started" title="In progress" count={1} empty="No issues">
		<Board.Card value="WEB-9" move={{ action: "/issues/WEB-9", name: "status" }}>
			<a href="/issues/WEB-9">Queue edits while offline</a>
		</Board.Card>
	</Board.Column>
	<Board.Column value="done" title="Done" count={0} empty="No issues" />
</Board>`;

/** The preview's cards, by column. */
const COLUMNS = [
	{
		value: "todo",
		title: "Todo",
		cards: [
			["WEB-12", "Fix the cart badge"],
			["WEB-14", "Keep the country on reset"],
		],
	},
	{ value: "started", title: "In progress", cards: [["WEB-9", "Queue edits while offline"]] },
	{ value: "done", title: "Done", cards: [] },
] as const;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", "--ui-board-column-width": "13rem" })]}>
			<Board id="preview-board" label="Issues by status">
				{COLUMNS.map((column) => (
					<Board.Column
						value={column.value}
						title={column.title}
						count={column.cards.length}
						empty="No issues"
					>
						{column.cards.map(([id, title]) => (
							<Board.Card value={id}>
								<span
									mix={[
										raw({
											display: "block",
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.75rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{id}
								</span>
								<a
									href={`#${id}`}
									draggable="false"
									mix={[
										raw({
											fontSize: "0.875rem",
											fontWeight: "500",
											color: "inherit",
											textDecoration: "none",
										}),
									]}
								>
									{title}
								</a>
							</Board.Card>
						))}
					</Board.Column>
				))}
			</Board>
		</div>
	),
};
