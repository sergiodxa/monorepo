/**
 * Tables the table's browser tests mount, on a hovering pointer and on touch: monitors, long
 * posts and articles with row actions, and the measurements those tests share, so both test
 * files assert against the same rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { render } from "remix/component/test";
import { expect } from "vitest";

import { Table } from "../app/table.js";
import { LinkButton } from "../components/link-button.js";

/** One monitor row, enough columns to overflow a phone. */
export interface Monitor {
	id: string;
	name: string;
	region: string;
	ms: number;
}

/** Twelve monitors, enough rows to scroll a container and overflow a phone. */
export const MONITORS: Monitor[] = Array.from({ length: 12 }, (_, index) => ({
	id: `mon_${index}`,
	name: `api-${index}.example.com`,
	region: "Frankfurt, Germany",
	ms: 100 + index * 7,
}));

/** Mounts `node` in a host `width` pixels wide and returns the host. */
export function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A monitors table with selection, a row link and actions, in a container `height` tall. */
export function monitors(props: Partial<Table.Props> = {}, height?: number): JSX.Element {
	return (
		<Table.Container mix={[]} style={height ? { maxHeight: `${height}px` } : undefined}>
			<Table aria-label="Monitors" {...props}>
				<Table.Header>
					<Table.Row>
						<Table.SelectAll label="Select all monitors" />
						<Table.Column>Name</Table.Column>
						<Table.Column>Region</Table.Column>
						<Table.Column numeric>Response</Table.Column>
						<Table.ActionsColumn label="Actions" />
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{MONITORS.map((monitor) => (
						<Table.Row key={monitor.id}>
							<Table.Select name="monitor" value={monitor.id} label={`Select ${monitor.name}`} />
							<Table.Cell>
								<Table.RowLink href={`#${monitor.id}`}>{monitor.name}</Table.RowLink>
							</Table.Cell>
							<Table.Cell>{monitor.region}</Table.Cell>
							<Table.NumberCell
								value={monitor.ms}
								locale="en"
								format={{ style: "unit", unit: "millisecond" }}
							/>
							<Table.Actions>
								<button type="button">Pause</button>
								<button type="button">Delete</button>
							</Table.Actions>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	);
}

/** A post with a title long enough to squeeze every other column. */
export interface Post {
	id: string;
	title: string;
	excerpt: string;
}

/** Four posts whose long titles and excerpts squeeze the actions column. */
export const POSTS: Post[] = Array.from({ length: 4 }, (_, index) => ({
	id: `post_${index}`,
	title: `Designing a publishing workflow that survives a newsroom deadline, part ${index + 1}`,
	excerpt:
		"How a small editorial team drafts, reviews, schedules and corrects stories without stepping on each other.",
}));

/** Labels of the three row actions every post carries. */
export const ACTIONS = ["Edit", "Quick edit", "View"];

/**
 * One post's actions cell: plain ghost link buttons with `links`, else `Table.Action`s that fold
 * into a menu named "More actions".
 */
function PostActions(handle: Handle<{ id: string; labels: string[]; links?: boolean }>) {
	return () => {
		let { id, labels, links } = handle.props;
		if (links) {
			return (
				<Table.Actions>
					{labels.map((label) => (
						<LinkButton
							key={label}
							href={`#${id}/${label}`}
							variant="ghost"
							color="neutral"
							size="sm"
						>
							{label}
						</LinkButton>
					))}
				</Table.Actions>
			);
		}
		return (
			<Table.Actions overflowLabel="More actions">
				{labels.map((label) => (
					<Table.Action key={label} href={`#${id}/${label}`}>
						{label}
					</Table.Action>
				))}
			</Table.Actions>
		);
	};
}

/**
 * A comfortable posts table whose title and excerpt compete with the actions for width. With
 * `links`, the actions are plain ghost link buttons; otherwise they are `Table.Action`s that
 * fold into a menu named "More actions".
 */
export function posts(
	options: { links?: boolean; actions?: string[]; noActions?: boolean; date?: boolean } = {},
): JSX.Element {
	let actions = options.actions ?? ACTIONS;
	return (
		<Table.Container>
			<Table aria-label="Posts" density="comfortable">
				<Table.Header>
					<Table.Row>
						<Table.SelectAll label="Select all posts" />
						<Table.Column>Title</Table.Column>
						<Table.Column>Excerpt</Table.Column>
						<Table.Column>Status</Table.Column>
						{options.date ? <Table.Column>Published</Table.Column> : null}
						{options.noActions ? null : <Table.ActionsColumn label="Actions" />}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{POSTS.map((post) => (
						<Table.Row key={post.id}>
							<Table.Select name="post" value={post.id} label={`Select ${post.title}`} />
							<Table.Cell>
								<Table.RowLink href={`#${post.id}`}>{post.title}</Table.RowLink>
							</Table.Cell>
							<Table.Cell>{post.excerpt}</Table.Cell>
							<Table.StatusCell color="success">Published</Table.StatusCell>
							{options.date ? (
								<Table.DateCell
									date="2026-12-01T12:00:00Z"
									now="2026-12-20T12:00:00Z"
									locale="en-US"
									local
								/>
							) : null}
							{options.noActions ? null : (
								<PostActions id={post.id} labels={actions} links={options.links} />
							)}
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	);
}

/** Number of line boxes the text of `element` lays out in. */
export function lineBoxes(element: Element): number {
	let range = document.createRange();
	range.selectNodeContents(element);
	let tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
	return tops.size;
}

/** Asserts every action label in `host` sits on one line and its cell hugs the actions. */
export function expectOneLineActions(host: HTMLElement, labels: string[] = ACTIONS): void {
	let cells = [...host.querySelectorAll<HTMLElement>('tbody [data-slot="row-actions"]')];
	expect(cells).toHaveLength(POSTS.length);
	for (let cell of cells) {
		let actions = [...cell.querySelectorAll<HTMLElement>("a")].filter(
			(action) => action.getClientRects().length > 0,
		);
		expect(actions.map((action) => action.textContent)).toEqual(labels);
		for (let action of actions) expect(lineBoxes(action)).toBe(1);
		let first = actions[0]!.getBoundingClientRect();
		let last = actions.at(-1)!.getBoundingClientRect();
		let style = getComputedStyle(cell);
		let padding = parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd);
		expect(cell.getBoundingClientRect().width).toBeLessThanOrEqual(
			last.right - first.left + padding + 1,
		);
	}
}

/** Four row actions, enough to crowd the visible columns if their cell reserved their width. */
export const MANY_ACTIONS = ["Edit", "Quick edit", "View", "Duplicate"];

/** Labels of the overlay's three actions: two ghost links and a danger `Table.Action`. */
export const OVERLAY_ACTIONS = ["View", "Post on X", "Delete"];

/**
 * A four-column articles table whose last data cell is a "Published" status, with the three
 * actions an articles list carries: ghost link buttons and a danger `Table.Action`, or with
 * `actions`, three `Table.Action`s under an `overflowLabel`.
 */
export function articles(options: { actions?: boolean } = {}): JSX.Element {
	return (
		<Table.Container>
			<Table aria-label="Articles" density="comfortable">
				<Table.Header>
					<Table.Row>
						<Table.Column>Title</Table.Column>
						<Table.Column>Author</Table.Column>
						<Table.Column>Status</Table.Column>
						<Table.ActionsColumn label="Actions" />
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{POSTS.map((post) => (
						<Table.Row key={post.id}>
							<Table.Cell>
								<Table.RowLink href={`#${post.id}`}>{post.title}</Table.RowLink>
							</Table.Cell>
							<Table.Cell>Sergio</Table.Cell>
							<Table.StatusCell color="success">Published</Table.StatusCell>
							{options.actions ? (
								<Table.Actions overflowLabel={`More actions for ${post.title}`}>
									<Table.Action href={`#${post.id}/view`}>{OVERLAY_ACTIONS[0]}</Table.Action>
									<Table.Action href={`#${post.id}/share`}>{OVERLAY_ACTIONS[1]}</Table.Action>
									<Table.Action danger>{OVERLAY_ACTIONS[2]}</Table.Action>
								</Table.Actions>
							) : (
								<Table.Actions>
									<LinkButton href={`#${post.id}/view`} variant="ghost" color="neutral" size="sm">
										{OVERLAY_ACTIONS[0]}
									</LinkButton>
									<LinkButton href={`#${post.id}/share`} variant="ghost" color="neutral" size="sm">
										{OVERLAY_ACTIONS[1]}
									</LinkButton>
									<Table.Action danger>{OVERLAY_ACTIONS[2]}</Table.Action>
								</Table.Actions>
							)}
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	);
}

/** The controls inside `root` that lay out a box. */
export function shown(root: Element): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>("a, button")].filter(
		(control) => control.getClientRects().length > 0,
	);
}

/** Accessible name `control` takes from `aria-label`, else from the elements `aria-labelledby` names. */
export function accessibleName(control: HTMLElement): string {
	let label = control.getAttribute("aria-label");
	if (label) return label;
	let ids = control.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
	return ids
		.map((id) => document.getElementById(id)?.textContent ?? "")
		.join(" ")
		.trim();
}

/** Whether two boxes share any area. */
export function intersects(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
