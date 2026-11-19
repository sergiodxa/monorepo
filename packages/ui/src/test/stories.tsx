/**
 * The viewer the story viewer's browser tests mount, on a hovering pointer and on touch: three
 * people with two or three segments each, timed in tenths of a second so a test watches a bar
 * fill, and the queries both test files share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { expect, vi } from "vitest";

import { StoryViewer } from "../video/story-viewer.js";

/** Each person's segment count. */
const PEOPLE = [
	{ id: "ana", segments: 2 },
	{ id: "bo", segments: 3 },
	{ id: "cy", segments: 2 },
] as const;

/** The address of one segment, as a query on the test page. */
function storyHref(person: string, segment: number): string {
	return `?story=${person}-${segment}`;
}

/**
 * Mounts the viewer opening on `person`'s first segment, every segment lasting `seconds`.
 *
 * @param person The person whose group is active.
 * @param seconds Each segment's length.
 * @param boxed Shows the viewer inside a box on the page rather than over the whole window.
 */
export function mountStories(person = "ana", seconds = 30, boxed = false): RenderResult {
	return render(
		<div
			style={
				boxed
					? "position: relative; block-size: 400px; --ui-story-viewer-position: absolute; --ui-story-viewer-height: 400px"
					: undefined
			}
		>
			<StoryViewer label="Stories" closeHref="?closed" labels={{ close: "Close", pause: "Pause" }}>
				{PEOPLE.map((entry, position) => {
					let before = PEOPLE[position - 1];
					let previousHref = before ? storyHref(before.id, before.segments - 1) : "?closed";
					let nextHref = entry.segments > 1 ? storyHref(entry.id, 1) : "?closed";
					return (
						<StoryViewer.Group
							id={`group-${entry.id}`}
							label={`${entry.id}'s story`}
							durations={Array.from({ length: entry.segments }, () => seconds)}
							current={0}
							active={entry.id === person}
							previousHref={previousHref}
							nextHref={nextHref}
							labels={{ previous: "Previous", next: "Next" }}
							header={<p>{entry.id}</p>}
						>
							{Array.from({ length: entry.segments }, (_, index) => (
								<StoryViewer.Segment href={storyHref(entry.id, index)} current={index === 0}>
									<div style={`background: hsl(${index * 90 + position * 30} 60% 40%)`} />
								</StoryViewer.Segment>
							))}
						</StoryViewer.Group>
					);
				})}
			</StoryViewer>
		</div>,
	);
}

/** The viewer's root. */
export function viewerOf(mounted: RenderResult): HTMLElement {
	let viewer = mounted.container.querySelector<HTMLElement>("[data-slot=story-viewer]");
	if (viewer === null) throw new Error("No viewer");
	return viewer;
}

/** The index of a group's current segment. */
export function currentSegment(mounted: RenderResult, person: string): number {
	let segments = [
		...mounted.container.querySelectorAll(`#group-${person} [data-slot=story-viewer-segment]`),
	];
	return segments.findIndex((segment) => segment.hasAttribute("data-current"));
}

/** The id of the group on screen. */
export function activeGroup(mounted: RenderResult): string | undefined {
	return mounted.container.querySelector("[data-story-active]")?.id;
}

/** Resolves once the viewer's island runs. */
export async function waitForViewer(mounted: RenderResult): Promise<void> {
	await vi.waitFor(() =>
		expect(mounted.container.querySelector("[data-story-ready]")).not.toBeNull(),
	);
}

/**
 * Records each time the viewer leaves through its close link, keeping the test page in place.
 *
 * @returns A list that grows by one per close.
 */
export function watchClose(mounted: RenderResult): string[] {
	let closes: string[] = [];
	mounted.container.querySelector("[data-story-close]")?.addEventListener("click", (event) => {
		event.preventDefault();
		closes.push("closed");
	});
	return closes;
}
