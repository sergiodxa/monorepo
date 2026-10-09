/**
 * Layout for graphs with nested groups, such as flowchart subgraphs and
 * composite states. Each group is laid out on its own, inside out, and then
 * placed in its parent as a single node, so a group never overlaps a stranger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Box, Point } from "./geometry.js";
import type { Direction, GraphEdge, GraphLayout, GraphNode, PlacedEdge } from "./layered.js";

import { layoutGraph } from "./layered.js";

/** A node, placed inside the group it names or at the top level. */
export interface CompoundNode extends GraphNode {
	parent?: string;
}

/** A group of nodes and further groups, drawn as a box with a header. */
export interface CompoundGroup {
	id: string;
	parent?: string;
	/** The flow inside the group; the parent's when left out. */
	direction?: Direction;
	/** The size of the header label above the group's contents. */
	header: { width: number; height: number };
}

/** A graph whose nodes may sit in groups, and whose edges may name a group as an end. */
export interface CompoundGraph {
	direction: Direction;
	nodes: readonly CompoundNode[];
	groups: readonly CompoundGroup[];
	edges: readonly GraphEdge[];
	nodeGap?: number;
	rankGap?: number;
}

/** Everything placed, in absolute coordinates with the top-left corner at the origin. */
export interface CompoundLayout {
	width: number;
	height: number;
	nodes: Map<string, Box>;
	groups: Map<string, Box>;
	/**
	 * In the order the edges were given. A route runs between the centers of its
	 * two ends, even when one of them sits inside a group the route enters.
	 */
	edges: PlacedEdge[];
}

/** Space between a group's border and its contents. */
const GROUP_PADDING = 16;

/** The id of the top level, which no group may take. */
const ROOT = "\u0000root";

/**
 * Lays out every group from the innermost out. An edge is routed in the
 * innermost group holding both of its ends, between the members of that group
 * that hold them, and its ends are then moved onto the nodes it names.
 *
 * @param graph - Nodes, groups and edges
 * @returns Absolute positions for every node, group and edge
 */
export function layoutCompound(graph: CompoundGraph): CompoundLayout {
	let groups = new Map(graph.groups.map((group) => [group.id, group]));
	let parentOf = new Map<string, string>();
	for (let node of graph.nodes) parentOf.set(node.id, node.parent ?? ROOT);
	for (let group of graph.groups) parentOf.set(group.id, group.parent ?? ROOT);

	let members = new Map<string, string[]>([[ROOT, []]]);
	for (let group of graph.groups) members.set(group.id, []);
	for (let id of [
		...graph.nodes.map((node) => node.id),
		...graph.groups.map((group) => group.id),
	]) {
		members.get(parentOf.get(id) ?? ROOT)?.push(id);
	}

	let chain = (id: string): string[] => {
		let path = [id];
		let current = parentOf.get(id);
		while (current !== undefined && current !== ROOT && !path.includes(current)) {
			path.unshift(current);
			current = parentOf.get(current);
		}
		return [ROOT, ...path];
	};

	let scoped = new Map<string, { edge: number; lifted: GraphEdge }[]>();
	for (let [position, edge] of graph.edges.entries()) {
		let from = chain(edge.from);
		let to = chain(edge.to);
		let depth = 0;
		let limit = Math.min(from.length, to.length) - 1;
		while (depth + 1 < limit && from[depth + 1] === to[depth + 1]) depth += 1;
		let scope = from[depth] ?? ROOT;
		let lifted = { ...edge, from: from[depth + 1] ?? edge.from, to: to[depth + 1] ?? edge.to };
		let list = scoped.get(scope) ?? [];
		list.push({ edge: position, lifted });
		scoped.set(scope, list);
	}

	let sizes = new Map(
		graph.nodes.map((node) => [node.id, { width: node.width, height: node.height }]),
	);
	let layouts = new Map<string, GraphLayout>();

	let layout = (scope: string, direction: Direction): GraphLayout => {
		let nodes: GraphNode[] = [];
		for (let id of members.get(scope) ?? []) {
			let group = groups.get(id);
			if (group) {
				let inner = layout(id, group.direction ?? direction);
				let width = Math.max(inner.width, group.header.width) + 2 * GROUP_PADDING;
				let height = inner.height + group.header.height + 2 * GROUP_PADDING;
				sizes.set(id, { width, height });
			}
			let size = sizes.get(id) ?? { width: 0, height: 0 };
			nodes.push({ id, ...size });
		}
		let result = layoutGraph(
			nodes,
			(scoped.get(scope) ?? []).map((entry) => entry.lifted),
			{ direction, nodeGap: graph.nodeGap, rankGap: graph.rankGap },
		);
		layouts.set(scope, result);
		return result;
	};

	let root = layout(ROOT, graph.direction);
	let placedNodes = new Map<string, Box>();
	let placedGroups = new Map<string, Box>();
	let routes: PlacedEdge[] = graph.edges.map(() => ({ points: [] }));

	let place = (scope: string, origin: Point): void => {
		let result = layouts.get(scope);
		if (!result) return;
		let move = (point: Point): Point => ({ x: point.x + origin.x, y: point.y + origin.y });
		for (let [id, box] of result.nodes) {
			let absolute = { ...box, ...move(box) };
			let group = groups.get(id);
			if (!group) {
				placedNodes.set(id, absolute);
				continue;
			}
			placedGroups.set(id, absolute);
			let inner = layouts.get(id);
			let innerWidth = inner?.width ?? 0;
			place(id, {
				x: absolute.x - absolute.width / 2 + (absolute.width - innerWidth) / 2,
				y: absolute.y - absolute.height / 2 + group.header.height + GROUP_PADDING,
			});
		}
		for (let [at, entry] of (scoped.get(scope) ?? []).entries()) {
			let route = result.edges[at];
			if (!route) continue;
			let placed: PlacedEdge = { points: route.points.map(move) };
			if (route.label) placed.label = move(route.label);
			routes[entry.edge] = placed;
		}
	};
	place(ROOT, { x: 0, y: 0 });

	for (let [position, edge] of graph.edges.entries()) {
		let route = routes[position];
		if (!route || route.points.length < 2) continue;
		let from = placedNodes.get(edge.from) ?? placedGroups.get(edge.from);
		let to = placedNodes.get(edge.to) ?? placedGroups.get(edge.to);
		if (from) route.points[0] = { x: from.x, y: from.y };
		if (to) route.points[route.points.length - 1] = { x: to.x, y: to.y };
	}

	return {
		width: root.width,
		height: root.height,
		nodes: placedNodes,
		groups: placedGroups,
		edges: routes,
	};
}
