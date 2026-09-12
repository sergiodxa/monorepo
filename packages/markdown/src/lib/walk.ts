/**
 * The one transform mechanism: a top-down traversal that returns a new tree and
 * shares every subtree no handler touched. A handler that throws becomes a
 * failure carrying the position it was standing on, rather than an exception.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Markdown } from "../index.js";

import { MarkdownWalkError } from "./errors.js";

/** What a handler hands back, widened from the per-type union the visitor declares. */
type Handled = Markdown.Node | Markdown.Node[] | null | undefined;

/** A node's fate once its handler has spoken and its children have been walked. */
type Transformed = Markdown.Node | Markdown.Node[] | null;

/** A handler read off the visitor at a type only known while the walk runs. */
type Handler = (node: Markdown.Node, parent: Markdown.Parent | null) => Handled | Promise<Handled>;

/** Everything a block slot holds, which is what a block handler may yield into one. */
const BLOCK_TYPES = new Set<string>([
	"heading",
	"paragraph",
	"code",
	"list",
	"listItem",
	"blockquote",
	"alert",
	"table",
	"tableRow",
	"tableCell",
	"thematicBreak",
	"html",
	"footnoteDefinition",
	"tag",
]);

/** Everything an inline slot holds, which is what an inline handler may yield into one. */
const INLINE_TYPES = new Set<string>([
	"text",
	"emphasis",
	"strong",
	"strikethrough",
	"inlineCode",
	"link",
	"image",
	"softBreak",
	"hardBreak",
	"inlineHtml",
	"footnoteReference",
	"variable",
	"tag",
]);

/** The parents whose children are inline, which is what decides the slot a child stands in. */
const INLINE_PARENT_TYPES = new Set<string>([
	"heading",
	"paragraph",
	"tableCell",
	"emphasis",
	"strong",
	"strikethrough",
	"link",
	"image",
]);

/**
 * @param node - The node to walk, which the result is returned as
 * @param visitor - Handlers keyed by node type
 * @returns The rewritten node, wrapped in a promise once a handler returns one
 */
export function walkNode(
	node: Markdown.Node,
	visitor: Markdown.Visitor,
): Result<Markdown.Node, Markdown.WalkError> | Promise<Result<Markdown.Node, Markdown.WalkError>> {
	let walked: Markdown.Node | Promise<Markdown.Node>;

	try {
		walked = visitRoot(node, visitor);
	} catch (error) {
		return failure(walkErrorFor(error, node));
	}

	if (isThenable<Markdown.Node>(walked)) {
		return Promise.resolve(walked).then(
			(resolved) => success(resolved),
			(error: unknown) => failure(walkErrorFor(error, node)),
		);
	}

	return success(walked);
}

/**
 * Visits the node the walk started from, which has to be handed back as one node
 * of the category it came in as, so removal and splicing are failures here and
 * legal everywhere below.
 */
function visitRoot(
	node: Markdown.Node,
	visitor: Markdown.Visitor,
): Markdown.Node | Promise<Markdown.Node> {
	let handler = handlerFor(visitor, node.type);
	if (handler === undefined) return walkChildrenOf(node, visitor);

	return chain(runHandler(handler, node, null), (visited) => {
		if (visited === undefined) return walkChildrenOf(node, visitor);

		if (visited === null) {
			throw new MarkdownWalkError(
				`A ${node.type} handler returned null for the node the walk started from, which is handed back whole`,
				{ position: node.position },
			);
		}

		if (Array.isArray(visited)) {
			throw new MarkdownWalkError(
				`A ${node.type} handler yielded ${visited.length} nodes for the node the walk started from, which is handed back as one`,
				{ position: node.position },
			);
		}

		if (!sameCategory(node, visited)) {
			throw new MarkdownWalkError(
				`A ${node.type} handler replaced the node the walk started from with a ${visited.type}, which belongs to another category`,
				{ position: node.position },
			);
		}

		return walkChildrenOf(visited, visitor);
	});
}

/**
 * Visits one node below the root: its handler decides the node's fate, and the
 * children of whatever comes back are walked next, so a replacement is never
 * handed to a handler itself.
 */
function transformNode(
	node: Markdown.Node,
	parent: Markdown.Parent,
	visitor: Markdown.Visitor,
): Transformed | Promise<Transformed> {
	let handler = handlerFor(visitor, node.type);
	if (handler === undefined) return walkChildrenOf(node, visitor);

	return chain(runHandler(handler, node, parent), (visited) => {
		if (visited === undefined) return walkChildrenOf(node, visitor);
		if (visited === null) return null;

		if (Array.isArray(visited)) {
			for (let yielded of visited) assertSlot(node, parent, yielded);
			return walkEachChildrenOf(visited, visitor, 0, []);
		}

		assertSlot(node, parent, visited);
		return walkChildrenOf(visited, visitor);
	});
}

/**
 * Walks a node's children and rebuilds it only when one of them changed, which
 * is what lets a walk that touches a single heading copy one spine and share
 * every other subtree by reference.
 */
function walkChildrenOf(
	node: Markdown.Node,
	visitor: Markdown.Visitor,
): Markdown.Node | Promise<Markdown.Node> {
	if (!hasChildren(node)) return node;

	let children: Markdown.Node[] = node.children;

	return chain(walkChildren(children, node, visitor, 0, []), (walked) => {
		if (sameChildren(children, walked)) return node;
		return { ...node, children: walked } as Markdown.Node;
	});
}

/**
 * Walks the children from `index` on, switching to a promise chain at the first
 * handler that returns one, so a visitor with no asynchronous handler finishes
 * without allocating a promise.
 */
function walkChildren(
	children: Markdown.Node[],
	parent: Markdown.Parent,
	visitor: Markdown.Visitor,
	index: number,
	collected: Markdown.Node[],
): Markdown.Node[] | Promise<Markdown.Node[]> {
	let cursor = index;

	while (cursor < children.length) {
		let transformed = transformNode(children[cursor] as Markdown.Node, parent, visitor);

		if (isThenable<Transformed>(transformed)) {
			let next = cursor + 1;
			return Promise.resolve(transformed).then((resolved) => {
				collect(collected, resolved);
				return walkChildren(children, parent, visitor, next, collected);
			});
		}

		collect(collected, transformed);
		cursor += 1;
	}

	return collected;
}

/** Walks the children of every node a handler spliced in, keeping the same sync-until-needed shape. */
function walkEachChildrenOf(
	nodes: Markdown.Node[],
	visitor: Markdown.Visitor,
	index: number,
	collected: Markdown.Node[],
): Markdown.Node[] | Promise<Markdown.Node[]> {
	let cursor = index;

	while (cursor < nodes.length) {
		let walked = walkChildrenOf(nodes[cursor] as Markdown.Node, visitor);

		if (isThenable<Markdown.Node>(walked)) {
			let next = cursor + 1;
			return Promise.resolve(walked).then((resolved) => {
				collected.push(resolved);
				return walkEachChildrenOf(nodes, visitor, next, collected);
			});
		}

		collected.push(walked);
		cursor += 1;
	}

	return collected;
}

/** Turns whatever a handler decided into the nodes that stand in the original's place. */
function collect(collected: Markdown.Node[], transformed: Transformed): void {
	if (transformed === null) return;
	if (Array.isArray(transformed)) collected.push(...transformed);
	else collected.push(transformed);
}

/**
 * Runs one handler, turning both a throw and a rejection into the walk's own
 * error so the failure names the line the visitor was standing on.
 */
function runHandler(
	handler: Handler,
	node: Markdown.Node,
	parent: Markdown.Parent | null,
): Handled | Promise<Handled> {
	let visited: Handled | Promise<Handled>;

	try {
		visited = handler(node, parent);
	} catch (error) {
		throw walkErrorFor(error, node);
	}

	if (isThenable<Handled>(visited)) {
		return Promise.resolve(visited).catch((error: unknown) => {
			throw walkErrorFor(error, node);
		});
	}

	return visited;
}

/** Keeps the thrown value verbatim as the cause, which is what a caller matches on to tell a bug from a rejection. */
function walkErrorFor(error: unknown, node: Markdown.Node): MarkdownWalkError {
	if (error instanceof MarkdownWalkError) return error;
	let reason = error instanceof Error ? error.message : String(error);
	return new MarkdownWalkError(`A ${node.type} handler failed: ${reason}`, {
		cause: error,
		position: node.position,
	});
}

/** Fails the walk when a handler yields a node the surrounding slot cannot hold. */
function assertSlot(node: Markdown.Node, parent: Markdown.Parent, yielded: Markdown.Node): void {
	if (accepts(parent, yielded.type)) return;
	throw new MarkdownWalkError(
		`A ${node.type} handler yielded a ${yielded.type}, which a ${parent.type} cannot hold`,
		{ position: node.position },
	);
}

/** A tag stands in either column, so its children are checked against both. */
function accepts(parent: Markdown.Parent, type: string): boolean {
	if (parent.type === "tag") return BLOCK_TYPES.has(type) || INLINE_TYPES.has(type);
	if (INLINE_PARENT_TYPES.has(parent.type)) return INLINE_TYPES.has(type);
	return BLOCK_TYPES.has(type);
}

/** Holds the root's replacement to the category it came in as, so a document walk hands back a document. */
function sameCategory(node: Markdown.Node, replacement: Markdown.Node): boolean {
	if (node.type === "document" || replacement.type === "document") {
		return node.type === replacement.type;
	}

	if (BLOCK_TYPES.has(node.type) && BLOCK_TYPES.has(replacement.type)) return true;
	return INLINE_TYPES.has(node.type) && INLINE_TYPES.has(replacement.type);
}

/** Reads a handler off the mapped visitor type, which a run-time type name cannot index. */
function handlerFor(visitor: Markdown.Visitor, type: Markdown.Node["type"]): Handler | undefined {
	return (visitor as Record<string, Handler | undefined>)[type];
}

/** The parents are exactly the nodes carrying a children array, which the union already says. */
function hasChildren(node: Markdown.Node): node is Markdown.Parent {
	return "children" in node && Array.isArray(node.children);
}

/** Identity across the whole list is what says a subtree survived untouched. */
function sameChildren(before: Markdown.Node[], after: Markdown.Node[]): boolean {
	if (before.length !== after.length) return false;
	for (let index = 0; index < before.length; index += 1) {
		if (before[index] !== after[index]) return false;
	}
	return true;
}

/** Stays on the synchronous path until a value actually arrives as a promise. */
function chain<A, B>(value: A | Promise<A>, step: (value: A) => B | Promise<B>): B | Promise<B> {
	if (isThenable<A>(value)) return Promise.resolve(value).then(step);
	return step(value as A);
}

/** A thenable is the one signal that turns the rest of the traversal asynchronous. */
function isThenable<T>(value: unknown): value is PromiseLike<T> {
	if (typeof value !== "object" || value === null) return false;
	return typeof (value as PromiseLike<T>).then === "function";
}
