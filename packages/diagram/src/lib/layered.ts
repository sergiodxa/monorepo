/**
 * Layered graph layout for the box-and-arrow diagrams: cycles broken, nodes
 * ranked along the flow, ranks ordered to cut crossings, and nodes placed
 * across the flow so edges run as straight as their neighbors allow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Box, Point } from "./geometry.js";

/** A node to place, by its size. */
export interface GraphNode {
	id: string;
	width: number;
	height: number;
}

/** An edge between two node ids. */
export interface GraphEdge {
	from: string;
	to: string;
	/**
	 * How many ranks the edge spans at least.
	 *
	 * @default 1
	 */
	length?: number;
	/** The size of the edge's label, which the layout leaves room for midway. */
	label?: { width: number; height: number };
}

/** Which way edges flow: top to bottom, bottom to top, left to right, right to left. */
export type Direction = "TB" | "BT" | "LR" | "RL";

/** Layout spacing and flow. */
export interface GraphOptions {
	direction: Direction;
	/**
	 * Space between neighbors in one rank.
	 *
	 * @default 32
	 */
	nodeGap?: number;
	/**
	 * Space between ranks.
	 *
	 * @default 48
	 */
	rankGap?: number;
}

/** An edge's route from its source node's center to its target's, and where its label goes. */
export interface PlacedEdge {
	points: Point[];
	label?: Point;
}

/** Everything placed, with the drawing's top-left corner at the origin. */
export interface GraphLayout {
	width: number;
	height: number;
	nodes: Map<string, Box>;
	/** In the order the edges were given. */
	edges: PlacedEdge[];
}

/** A node or a dummy, sized across and along the flow. */
interface Vertex {
	cross: number;
	along: number;
	rank: number;
	dummy: boolean;
	x: number;
	y: number;
}

/** An edge between real nodes, oriented so it points down the ranks. */
interface Arc {
	edge: number;
	tail: number;
	head: number;
	minLength: number;
	reversed: boolean;
	/** The dummies the arc passes through, one per rank between its ends. */
	chain: number[];
	labelVertex?: number;
}

/** A link between vertices in neighboring ranks. */
interface Segment {
	from: number;
	to: number;
}

/** How far a self-loop reaches out of its node. */
const LOOP_REACH = 22;

/** Ordering sweeps; each alternates direction and the best ordering seen wins. */
const ORDER_SWEEPS = 24;

/** Placement sweeps, each one down the ranks and one back up. */
const PLACE_SWEEPS = 8;

/**
 * Places the nodes and routes the edges. Edge routes run center to center
 * through the bends the layout chose, so a renderer clips their ends to each
 * node's own outline. Every rank is doubled, so every edge has a midpoint
 * vertex to carry its label.
 *
 * @param nodes - The nodes, whose order breaks ties
 * @param edges - The edges; an edge naming a missing node is left unrouted with no points
 * @param options - Flow and spacing
 * @returns Node centers and edge routes
 */
export function layoutGraph(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	options: GraphOptions,
): GraphLayout {
	let horizontal = options.direction === "LR" || options.direction === "RL";
	let nodeGap = options.nodeGap ?? 32;
	let rankGap = options.rankGap ?? 48;
	let index = new Map(nodes.map((node, position) => [node.id, position]));
	let vertices: Vertex[] = nodes.map((node) => ({
		cross: horizontal ? node.height : node.width,
		along: horizontal ? node.width : node.height,
		rank: 0,
		dummy: false,
		x: 0,
		y: 0,
	}));

	let arcs: Arc[] = [];
	let loops: number[] = [];
	for (let [position, edge] of edges.entries()) {
		let tail = index.get(edge.from);
		let head = index.get(edge.to);
		if (tail === undefined || head === undefined) continue;
		if (tail === head) {
			loops.push(position);
			continue;
		}
		arcs.push({
			edge: position,
			tail,
			head,
			minLength: 2 * Math.max(1, edge.length ?? 1),
			reversed: false,
			chain: [],
		});
	}

	breakCycles(nodes.length, arcs);
	rank(vertices, arcs);

	let segments: Segment[] = [];
	for (let arc of arcs) {
		let previous = arc.tail;
		let start = vertices[arc.tail]?.rank ?? 0;
		let end = vertices[arc.head]?.rank ?? 0;
		let middle = start + Math.floor((end - start) / 2);
		let label = edges[arc.edge]?.label;
		for (let level = start + 1; level < end; level += 1) {
			let carried = level === middle ? label : undefined;
			let dummy = vertices.length;
			vertices.push({
				cross: carried ? (horizontal ? carried.height : carried.width + 8) : 0,
				along: carried ? (horizontal ? carried.width + 8 : carried.height) : 0,
				rank: level,
				dummy: true,
				x: 0,
				y: 0,
			});
			if (carried) arc.labelVertex = dummy;
			arc.chain.push(dummy);
			segments.push({ from: previous, to: dummy });
			previous = dummy;
		}
		segments.push({ from: previous, to: arc.head });
	}

	let layers = order(vertices, segments, nodes.length);
	placeAlong(vertices, layers, rankGap);
	placeAcross(vertices, layers, segments, nodeGap);

	let extent = Math.max(0, ...vertices.map((vertex) => vertex.y + vertex.along / 2));
	let toPoint = (vertex: Vertex): Point => {
		if (options.direction === "TB") return { x: vertex.x, y: vertex.y };
		if (options.direction === "BT") return { x: vertex.x, y: extent - vertex.y };
		if (options.direction === "LR") return { x: vertex.y, y: vertex.x };
		return { x: extent - vertex.y, y: vertex.x };
	};

	let placed = new Map<string, Box>();
	for (let [position, node] of nodes.entries()) {
		let center = toPoint(vertices[position] as Vertex);
		placed.set(node.id, { ...center, width: node.width, height: node.height });
	}

	let routes: PlacedEdge[] = edges.map(() => ({ points: [] }));
	for (let arc of arcs) {
		let points = [arc.tail, ...arc.chain, arc.head].map((vertex) =>
			toPoint(vertices[vertex] as Vertex),
		);
		if (arc.reversed) points.reverse();
		let route: PlacedEdge = { points };
		if (arc.labelVertex !== undefined) route.label = toPoint(vertices[arc.labelVertex] as Vertex);
		routes[arc.edge] = route;
	}
	for (let position of loops) {
		let box = placed.get(edges[position]?.from ?? "");
		if (!box) continue;
		let reach = box.x + box.width / 2 + LOOP_REACH;
		let quarter = box.height / 4;
		let route: PlacedEdge = {
			points: [
				{ x: box.x, y: box.y },
				{ x: reach, y: box.y - quarter },
				{ x: reach, y: box.y + quarter },
				{ x: box.x, y: box.y },
			],
		};
		let label = edges[position]?.label;
		if (label) route.label = { x: reach + label.width / 2 + 6, y: box.y };
		routes[position] = route;
	}

	return normalize(placed, routes, edges);
}

/**
 * Reverses the arcs a depth-first search finds pointing back up its stack,
 * leaving a graph with no cycles. Search order follows the node order, so the
 * first node declared stays at the top of a cycle.
 */
function breakCycles(count: number, arcs: Arc[]): void {
	let outgoing: Arc[][] = Array.from({ length: count }, () => []);
	for (let arc of arcs) outgoing[arc.tail]?.push(arc);
	let state = Array.from({ length: count }, () => 0);

	let visit = (vertex: number): void => {
		state[vertex] = 1;
		for (let arc of outgoing[vertex] ?? []) {
			if (state[arc.head] === 1) arc.reversed = true;
			else if (state[arc.head] === 0) visit(arc.head);
		}
		state[vertex] = 2;
	};

	for (let vertex = 0; vertex < count; vertex += 1) {
		if (state[vertex] === 0) visit(vertex);
	}

	for (let arc of arcs) {
		if (!arc.reversed) continue;
		[arc.tail, arc.head] = [arc.head, arc.tail];
	}
}

/**
 * Longest-path ranking, then each source pulled down next to its nearest
 * successor so a node declared late does not hang a long edge from the top.
 */
function rank(vertices: Vertex[], arcs: readonly Arc[]): void {
	let incoming: Arc[][] = vertices.map(() => []);
	let outgoing: Arc[][] = vertices.map(() => []);
	for (let arc of arcs) {
		incoming[arc.head]?.push(arc);
		outgoing[arc.tail]?.push(arc);
	}

	let remaining = incoming.map((list) => list.length);
	let queue = vertices.flatMap((_, vertex) => (remaining[vertex] === 0 ? [vertex] : []));
	let sorted: number[] = [];
	while (queue.length > 0) {
		let vertex = queue.shift() as number;
		sorted.push(vertex);
		for (let arc of outgoing[vertex] ?? []) {
			let head = vertices[arc.head] as Vertex;
			head.rank = Math.max(head.rank, (vertices[vertex] as Vertex).rank + arc.minLength);
			remaining[arc.head] = (remaining[arc.head] ?? 1) - 1;
			if (remaining[arc.head] === 0) queue.push(arc.head);
		}
	}

	for (let vertex of sorted) {
		let out = outgoing[vertex] ?? [];
		if ((incoming[vertex] ?? []).length > 0 || out.length === 0) continue;
		(vertices[vertex] as Vertex).rank = Math.min(
			...out.map((arc) => (vertices[arc.head] as Vertex).rank - arc.minLength),
		);
	}
}

/**
 * Orders every rank: a depth-first pass seeds an order that keeps connected
 * nodes together, then barycenter sweeps reorder it, keeping the ordering with
 * the fewest crossings seen.
 *
 * @returns The vertices of each rank, in order across the flow
 */
function order(
	vertices: readonly Vertex[],
	segments: readonly Segment[],
	realCount: number,
): number[][] {
	let levels = Math.max(0, ...vertices.map((vertex) => vertex.rank)) + 1;
	let layers: number[][] = Array.from({ length: levels }, () => []);
	let predecessors: number[][] = vertices.map(() => []);
	let successors: number[][] = vertices.map(() => []);
	for (let segment of segments) {
		successors[segment.from]?.push(segment.to);
		predecessors[segment.to]?.push(segment.from);
	}

	let seen = new Set<number>();
	let visit = (vertex: number): void => {
		if (seen.has(vertex)) return;
		seen.add(vertex);
		layers[(vertices[vertex] as Vertex).rank]?.push(vertex);
		for (let next of successors[vertex] ?? []) visit(next);
	};
	for (let vertex = 0; vertex < realCount; vertex += 1) visit(vertex);
	for (let vertex = 0; vertex < vertices.length; vertex += 1) visit(vertex);

	let position = new Map<number, number>();
	let index = (): void => {
		for (let layer of layers) for (let [at, vertex] of layer.entries()) position.set(vertex, at);
	};
	index();

	let byRank: Segment[][] = Array.from({ length: levels }, () => []);
	for (let segment of segments) byRank[(vertices[segment.from] as Vertex).rank]?.push(segment);
	let crossings = (): number => {
		let total = 0;
		for (let level of byRank) {
			for (let first = 0; first < level.length; first += 1) {
				for (let second = first + 1; second < level.length; second += 1) {
					let a = level[first] as Segment;
					let b = level[second] as Segment;
					let top = (position.get(a.from) ?? 0) - (position.get(b.from) ?? 0);
					let bottom = (position.get(a.to) ?? 0) - (position.get(b.to) ?? 0);
					if (top * bottom < 0) total += 1;
				}
			}
		}
		return total;
	};

	let best = layers.map((layer) => [...layer]);
	let fewest = crossings();
	for (let sweep = 0; sweep < ORDER_SWEEPS && fewest > 0; sweep += 1) {
		let down = sweep % 2 === 0;
		for (let step = 1; step < levels; step += 1) {
			let level = down ? step : levels - 1 - step;
			let layer = layers[level] as number[];
			let neighbors = down ? predecessors : successors;
			let weight = new Map(
				layer.map((vertex) => {
					let around = neighbors[vertex] ?? [];
					if (around.length === 0) return [vertex, position.get(vertex) ?? 0];
					let sum = around.reduce((total, other) => total + (position.get(other) ?? 0), 0);
					return [vertex, sum / around.length];
				}),
			);
			layer.sort((a, b) => (weight.get(a) ?? 0) - (weight.get(b) ?? 0));
			for (let [at, vertex] of layer.entries()) position.set(vertex, at);
		}
		let count = crossings();
		if (count < fewest) {
			fewest = count;
			best = layers.map((layer) => [...layer]);
		}
	}

	return best;
}

/** Sets each rank's position along the flow, leaving room for its thickest member. */
function placeAlong(vertices: Vertex[], layers: readonly number[][], rankGap: number): void {
	let offset = 0;
	let previous = 0;
	for (let [level, layer] of layers.entries()) {
		let thickness = Math.max(0, ...layer.map((vertex) => (vertices[vertex] as Vertex).along));
		offset += level === 0 ? thickness / 2 : previous / 2 + rankGap / 2 + thickness / 2;
		for (let vertex of layer) (vertices[vertex] as Vertex).y = offset;
		previous = thickness;
	}
}

/**
 * Sets each vertex's position across the flow. Each sweep pulls every vertex
 * toward the weighted mean of its neighbors in the rank it was just aligned to,
 * then settles the rank with the least total movement that keeps every gap.
 * Dummy-to-dummy links weigh most, which keeps long edges straight.
 */
function placeAcross(
	vertices: Vertex[],
	layers: readonly number[][],
	segments: readonly Segment[],
	nodeGap: number,
): void {
	let predecessors: number[][] = vertices.map(() => []);
	let successors: number[][] = vertices.map(() => []);
	for (let segment of segments) {
		successors[segment.from]?.push(segment.to);
		predecessors[segment.to]?.push(segment.from);
	}

	let gap = (a: Vertex, b: Vertex): number => {
		let space = a.dummy && b.dummy ? nodeGap / 4 : a.dummy || b.dummy ? nodeGap / 2 : nodeGap;
		return (a.cross + b.cross) / 2 + space;
	};

	for (let layer of layers) {
		let x = 0;
		for (let [at, vertex] of layer.entries()) {
			let current = vertices[vertex] as Vertex;
			if (at > 0) x += gap(vertices[layer[at - 1] as number] as Vertex, current);
			current.x = x;
		}
	}

	let settle = (layer: readonly number[], neighbors: readonly (readonly number[][])[]): void => {
		let desired: number[] = [];
		let weights: number[] = [];
		let offsets: number[] = [];
		let offset = 0;
		for (let [at, vertex] of layer.entries()) {
			let current = vertices[vertex] as Vertex;
			if (at > 0) offset += gap(vertices[layer[at - 1] as number] as Vertex, current);
			offsets.push(offset);
			let sum = 0;
			let total = 0;
			for (let list of neighbors) {
				for (let other of list[vertex] ?? []) {
					let neighbor = vertices[other] as Vertex;
					let weight =
						current.dummy && neighbor.dummy ? 8 : current.dummy || neighbor.dummy ? 2 : 1;
					sum += neighbor.x * weight;
					total += weight;
				}
			}
			desired.push(total === 0 ? current.x : sum / total);
			weights.push(total === 0 ? 0.001 : total);
		}
		let settled = isotonic(
			desired.map((value, at) => value - (offsets[at] ?? 0)),
			weights,
		);
		for (let [at, vertex] of layer.entries()) {
			(vertices[vertex] as Vertex).x = (settled[at] ?? 0) + (offsets[at] ?? 0);
		}
	};

	for (let sweep = 0; sweep < PLACE_SWEEPS; sweep += 1) {
		for (let level = 1; level < layers.length; level += 1)
			settle(layers[level] as number[], [predecessors]);
		for (let level = layers.length - 2; level >= 0; level -= 1)
			settle(layers[level] as number[], [successors]);
	}
	for (let layer of layers) settle(layer, [predecessors, successors]);
}

/**
 * Weighted isotonic regression by pooling adjacent violators: the
 * non-decreasing sequence closest to `values`. Subtracting each vertex's
 * minimum offset first turns "keep every gap" into "never decrease".
 */
function isotonic(values: readonly number[], weights: readonly number[]): number[] {
	let blocks: { value: number; weight: number; count: number }[] = [];
	for (let [at, value] of values.entries()) {
		blocks.push({ value, weight: weights[at] ?? 1, count: 1 });
		while (blocks.length > 1) {
			let last = blocks[blocks.length - 1] as { value: number; weight: number; count: number };
			let before = blocks[blocks.length - 2] as { value: number; weight: number; count: number };
			if (before.value <= last.value) break;
			let weight = before.weight + last.weight;
			blocks.splice(-2, 2, {
				value: (before.value * before.weight + last.value * last.weight) / weight,
				weight,
				count: before.count + last.count,
			});
		}
	}
	return blocks.flatMap((block) => Array.from({ length: block.count }, () => block.value));
}

/** Moves everything so the drawing's top-left corner, labels included, sits at the origin. */
function normalize(
	nodes: Map<string, Box>,
	edges: PlacedEdge[],
	input: readonly GraphEdge[],
): GraphLayout {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	let include = (x: number, y: number, width = 0, height = 0): void => {
		left = Math.min(left, x - width / 2);
		right = Math.max(right, x + width / 2);
		top = Math.min(top, y - height / 2);
		bottom = Math.max(bottom, y + height / 2);
	};

	for (let box of nodes.values()) include(box.x, box.y, box.width, box.height);
	for (let [position, edge] of edges.entries()) {
		for (let point of edge.points) include(point.x, point.y);
		let size = input[position]?.label;
		if (edge.label && size) include(edge.label.x, edge.label.y, size.width + 8, size.height);
	}
	if (left === Infinity) return { width: 0, height: 0, nodes, edges };

	let move = (point: Point): Point => ({ x: point.x - left, y: point.y - top });
	for (let [id, box] of nodes) nodes.set(id, { ...box, ...move(box) });
	let moved = edges.map((edge) => {
		let route: PlacedEdge = { points: edge.points.map(move) };
		if (edge.label) route.label = move(edge.label);
		return route;
	});
	return { width: right - left, height: bottom - top, nodes, edges: moved };
}
