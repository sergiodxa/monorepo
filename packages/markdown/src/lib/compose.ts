/**
 * Merges visitors into one, so independent plugins run in a single walk even when two
 * of them handle the same node type. Handlers for one type run in the order their
 * visitors were given, each on the node the one before it produced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** One handler, typed loosely so a chain can hold handlers for any node type. */
interface AnyHandler {
	(node: Markdown.Node, parent: Markdown.Parent | null): unknown;
}

/**
 * Builds the merged visitor. A type only one visitor handles keeps that handler as is;
 * a type several handle gets a chain that stops at a handler which removes the node,
 * splices it, or replaces it with a node of another type.
 *
 * @param visitors - The visitors to merge, in the order their handlers run
 * @returns One visitor holding every handler
 */
export function composeVisitors(visitors: readonly Markdown.Visitor[]): Markdown.Visitor {
	let chains = new Map<string, AnyHandler[]>();

	for (let visitor of visitors) {
		for (let [type, handler] of Object.entries(visitor)) {
			if (typeof handler !== "function") continue;
			let chain = chains.get(type) ?? [];
			chain.push(handler as AnyHandler);
			chains.set(type, chain);
		}
	}

	let composed: Record<string, AnyHandler> = {};

	for (let [type, chain] of chains) {
		let [only] = chain;
		composed[type] =
			chain.length === 1 && only ? only : (node, parent) => runChain(chain, 0, node, parent, false);
	}

	return composed as Markdown.Visitor;
}

/**
 * Runs a chain from `index` on. A handler answering with a promise turns the rest of
 * the chain into its continuation, so later handlers still see its result in order.
 *
 * @returns The final replacement, `undefined` when no handler changed the node, or a promise of either
 */
function runChain(
	chain: readonly AnyHandler[],
	index: number,
	node: Markdown.Node,
	parent: Markdown.Parent | null,
	replaced: boolean,
): unknown {
	let current = node;
	let changed = replaced;

	for (let at = index; at < chain.length; at++) {
		let result = chain[at]?.(current, parent);

		if (result instanceof Promise) {
			return result.then((settled: unknown) => {
				let step = advance(current, settled);
				if (step.done) return step.result;
				return runChain(chain, at + 1, step.node, parent, changed || step.node !== current);
			});
		}

		let step = advance(current, result);
		if (step.done) return step.result;
		if (step.node !== current) changed = true;
		current = step.node;
	}

	return changed ? current : undefined;
}

/** What one handler's answer means for the chain: carry on with a node, or stop with a result. */
type Step = { done: false; node: Markdown.Node } | { done: true; result: unknown };

/**
 * @param current - The node the handler was given
 * @param result - What it answered with
 * @returns The node the next handler receives, or the result the chain ends on
 */
function advance(current: Markdown.Node, result: unknown): Step {
	if (result === undefined) return { done: false, node: current };
	if (result === null || Array.isArray(result)) return { done: true, result };

	let replacement = result as Markdown.Node;
	if (replacement.type !== current.type) return { done: true, result };

	return { done: false, node: replacement };
}
