/**
 * How far along a project or cycle is, counted in estimate points from the visitor's view of
 * its issues, so moving a card to Done moves the project's bar, the roadmap and the burn-up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cycle, Project } from "./data";
import type { IssueView } from "./state";

/** An issue without an estimate counts as one point, so it still moves the bar. */
const UNESTIMATED_POINTS = 1;

/** Points finished and planned. */
export interface Points {
	done: number;
	total: number;
}

/** Sums the points of some issues, canceled ones left out of both sides. */
export function points(issues: IssueView[]): Points {
	let counted = issues.filter((issue) => issue.status !== "canceled");
	let weight = (issue: IssueView) => issue.estimate ?? UNESTIMATED_POINTS;
	return {
		done: counted
			.filter((issue) => issue.status === "done")
			.reduce((sum, issue) => sum + weight(issue), 0),
		total: counted.reduce((sum, issue) => sum + weight(issue), 0),
	};
}

/**
 * A project's points: its closed work from before the demo plus its issues as the visitor
 * sees them.
 */
export function projectPoints(project: Project, issues: IssueView[]): Points {
	let own = points(issues.filter((issue) => issue.project === project.id));
	return { done: project.baseline.done + own.done, total: project.baseline.total + own.total };
}

/** A cycle's points from its issues as the visitor sees them. */
export function cyclePoints(cycle: Cycle, issues: IssueView[]): Points {
	return points(issues.filter((issue) => issue.cycle === cycle.id));
}

/** A share from 0 to 1, or 0 when nothing is planned. */
export function share({ done, total }: Points): number {
	return total === 0 ? 0 : done / total;
}

/** A share as a whole percentage for a label. */
export function percent(value: Points): string {
	return `${Math.round(share(value) * 100)}%`;
}
