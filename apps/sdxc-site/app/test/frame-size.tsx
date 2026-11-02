/**
 * Browser-test helpers for a frame's placeholder: each mounts the placeholder and the content
 * it stands in for at the same width, so a test holds that the content lands in the box the
 * placeholder reserved and nothing after it moves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";

/**
 * Mounts a node inside a box `width` pixels wide and reads the rendered block size.
 *
 * @param node - The placeholder or the content.
 * @param width - The container width, matching the column the frame sits in.
 * @param wrap - Wraps the node the way its page does, such as in the app's theme.
 * @returns The box's height in pixels, rounded.
 */
export function blockSize(
	node: RemixNode,
	width: number,
	wrap: (node: RemixNode) => RemixNode = (inner) => inner,
): number {
	let mounted = render(
		<div data-testid="frame-size" style={`inline-size:${width}px`}>
			{wrap(node)}
		</div>,
	);
	let box = mounted.container.querySelector<HTMLElement>('[data-testid="frame-size"]');
	let height = Math.round(box?.getBoundingClientRect().height ?? -1);
	mounted.cleanup();
	return height;
}
