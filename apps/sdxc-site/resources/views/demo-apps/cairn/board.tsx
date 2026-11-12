/**
 * A team's board: its issues as cards in a column per state, dragged from one column to the
 * next with a mouse, or moved by each card's own menu without script, by keyboard or on a
 * phone. A card opens its issue in a sheet beside the board, which stays where it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { EllipsisIcon, PlusIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Button, Menu } from "@sdxc/ui";
import { setParamHref } from "@sdxc/ui/app";
import { Board, boardMoveFormId } from "@sdxc/ui/app/board";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";

import type { StatusId, Team } from "./data";
import type { IssueView, VisitorState } from "./state";

import {
	STATUSES,
	STATUS_NAMES,
	editHref,
	findLabel,
	findPerson,
	href,
	priorityRank,
} from "./data";
import { IssueDetail } from "./detail";
import { LabelChip, PersonTile, PriorityIcon, StatusIcon } from "./glyphs";
import { SHEET_LABELS } from "./labels";
import { CREATE_ID, CairnShell } from "./shell";

/** The states a board lays out; canceled issues leave the board. */
const COLUMNS: StatusId[] = STATUSES.filter((status) => status !== "canceled");

/** The board's id, which each card's move form id starts with. */
function boardId(team: Team): string {
	return `cairn-board-${team.id}`;
}

/** One card: its id and a menu to move it, the title as the link, then priority, labels and assignee. */
function IssueCard(handle: Handle<{ issue: IssueView; team: Team; url: URL; page: string }>) {
	return () => {
		let { issue, team, url, page } = handle.props;
		let menu = `cairn-move-${issue.id}`;
		let assignee = findPerson(issue.assignee);
		return (
			<Board.Card
				value={issue.id}
				move={{ action: editHref(page), name: "status", fields: { issue: issue.id } }}
			>
				<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}>
					<div
						mix={[
							raw({ display: "flex", alignItems: "center", gap: "0.5rem", blockSize: "1.25rem" }),
						]}
					>
						<span
							mix={[
								raw({
									flex: "1 1 auto",
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{issue.id}
						</span>
						<Button
							type="button"
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={menu}
							command="toggle-popover"
							aria-label={`Move ${issue.id}`}
							title="Move to…"
							mix={[
								raw({
									position: "relative",
									zIndex: "1",
									blockSize: "1.5rem",
									minInlineSize: "1.5rem",
									padding: "0",
									marginInlineEnd: "-0.375rem",
								}),
							]}
						>
							<EllipsisIcon size={16} aria-hidden="true" />
						</Button>
						<Menu id={menu} aria-label={`Move ${issue.id} to`} placement="bottom-end">
							{STATUSES.map((status) => (
								<Menu.Item
									type="submit"
									form={boardMoveFormId(boardId(team), issue.id)}
									name="status"
									value={status}
									aria-current={issue.status === status ? "true" : undefined}
								>
									<StatusIcon status={status} />
									{STATUS_NAMES[status]}
								</Menu.Item>
							))}
						</Menu>
					</div>
					<a
						href={setParamHref(url, "issue", issue.id)}
						data-rmx-prefetch="intent"
						draggable="false"
						mix={[
							raw({
								fontSize: "0.875rem",
								lineHeight: "1.25rem",
								fontWeight: "500",
								color: "var(--ui-neutral-fg-emphasis)",
								textDecoration: "none",
								outline: "none",
								"&::after": {
									content: '""',
									position: "absolute",
									inset: "0",
									borderRadius: "inherit",
								},
								"&:focus-visible::after": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
							}),
						]}
					>
						{issue.title}
					</a>
					<div
						mix={[
							raw({ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }),
						]}
					>
						<PriorityIcon priority={issue.priority} label />
						{issue.labels.slice(0, 2).map((id) => {
							let label = findLabel(id);
							return label ? <LabelChip label={label} /> : null;
						})}
						<span mix={[raw({ flex: "1 1 auto" })]} />
						{issue.estimate === undefined ? null : (
							<span
								mix={[
									raw({
										fontFamily: "var(--ui-font-mono)",
										fontSize: "0.75rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{issue.estimate}
							</span>
						)}
						<PersonTile person={assignee} size={18} />
					</div>
				</div>
			</Board.Card>
		);
	};
}

namespace BoardScreen {
	export interface Props {
		team: Team;
		state: VisitorState;
		issues: IssueView[];
		url: URL;
		collapsed: boolean;
	}
}

/** Renders a team's board, and the open issue's sheet over its edge. */
export function BoardScreen(handle: Handle<BoardScreen.Props>) {
	return () => {
		let { team, state, issues, collapsed } = handle.props;
		let url = new URL(handle.props.url);
		url.searchParams.delete("toast");
		let search = url.searchParams.toString();
		let page = `team/${team.id}/board${search === "" ? "" : `?${search}`}`;
		let ordered = COLUMNS.flatMap((status) =>
			issues
				.filter((issue) => issue.status === status)
				.sort(
					(a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id),
				),
		);
		let openId = url.searchParams.get("issue");
		let index = ordered.findIndex((issue) => issue.id === openId);
		let open = index === -1 ? undefined : ordered[index];
		let close = setParamHref(url, "issue", null);

		return (
			<CairnShell
				current={`board:${team.id}`}
				collapsed={collapsed}
				crumb={`${team.name} › Board`}
				state={state}
				team={team.id}
				from={page}
			>
				<div
					mix={[raw({ display: "flex", flexDirection: "column", gap: "1rem", minInlineSize: 0 })]}
				>
					<header
						mix={[
							raw({ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }),
						]}
					>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "1.125rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{`${team.name} board`}
						</h1>
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							Drag a card to change its status, or use its … menu.
						</p>
						<a
							href={href(`team/${team.id}`)}
							data-rmx-prefetch="intent"
							mix={[
								raw({
									marginInlineStart: "auto",
									fontSize: "0.8125rem",
									color: "var(--ui-brand-fg)",
								}),
							]}
						>
							Show as list
						</a>
					</header>
					<Board id={boardId(team)} label={`${team.name} issues by status`}>
						{COLUMNS.map((status) => {
							let cards = ordered.filter((issue) => issue.status === status);
							return (
								<Board.Column
									value={status}
									title={STATUS_NAMES[status]}
									icon={<StatusIcon status={status} />}
									count={cards.length}
									empty="No issues"
									actions={
										<Button
											type="button"
											variant="ghost"
											color="neutral"
											size="sm"
											commandfor={CREATE_ID}
											command="show-modal"
											aria-label={`Create issue in ${STATUS_NAMES[status]}`}
											title="Create issue"
											mix={[raw({ blockSize: "1.5rem", minInlineSize: "1.5rem", padding: "0" })]}
										>
											<PlusIcon size={14} aria-hidden="true" />
										</Button>
									}
								>
									{cards.map((issue) => (
										<IssueCard issue={issue} team={team} url={url} page={page} />
									))}
								</Board.Column>
							);
						})}
					</Board>
				</div>
				{open ? (
					<DetailSheet
						id="cairn-issue-sheet"
						title={open.title}
						description={`${open.id} · ${STATUS_NAMES[open.status]}`}
						closeHref={close}
						permalink={href(`issue/${open.id}`)}
						position={{
							index: index + 1,
							total: ordered.length,
							previousHref: index > 0 ? setParamHref(url, "issue", ordered[index - 1]!.id) : null,
							nextHref:
								index < ordered.length - 1
									? setParamHref(url, "issue", ordered[index + 1]!.id)
									: null,
						}}
						labels={SHEET_LABELS}
						keys="sheet"
						inset
					>
						<IssueDetail issue={open} state={state} returnTo={page} level={2} sheet />
					</DetailSheet>
				) : null}
			</CairnShell>
		);
	};
}
