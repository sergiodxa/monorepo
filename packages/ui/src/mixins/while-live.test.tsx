// @vitest-environment happy-dom

/**
 * Tests for {@link "./while-live"} against a real document: a probe mixin counts the change
 * events it hears from whichever target it was last rendered with, across mounting,
 * re-rendering with a replacement target, and unmounting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createElement, createMixin } from "remix/component";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { whileLive } from "./while-live.js";

/** Every change event the probe heard, labelled with the target it came from. */
let heard: string[] = [];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	heard = [];
});

/** A target that announces a change under its own name. */
class Target extends EventTarget {
	constructor(public label: string) {
		super();
	}

	/** Announces a change the probe should hear while it follows this target. */
	change(): void {
		this.dispatchEvent(new Event("change"));
	}
}

/** Records every change from the target it was last rendered with. */
const probe = createMixin<HTMLElement, [target: Target]>((handle) => {
	let follow = whileLive(handle, (target: Target, signal) => {
		target.addEventListener("change", () => heard.push(target.label), { signal });
	});

	return (target) => {
		follow(target);
		return createElement(handle.element, {});
	};
});

describe(whileLive.name, () => {
	test("hears a change dispatched the moment the host mounts", () => {
		let target = new Target("a");
		mounted = render(<div mix={[probe(target)]} />);

		target.change();

		expect(heard).toEqual(["a"]);
	});

	test("follows a replacement target and stops hearing the one it replaced", () => {
		let first = new Target("a");
		let second = new Target("b");
		mounted = render(<div mix={[probe(first)]} />);

		mounted.root.render(<div mix={[probe(second)]} />);
		mounted.root.flush();
		first.change();
		second.change();

		expect(heard).toEqual(["b"]);
	});

	test("stops hearing its target once the host unmounts", () => {
		let target = new Target("a");
		mounted = render(<div mix={[probe(target)]} />);

		mounted.cleanup();
		mounted = undefined;
		target.change();

		expect(heard).toEqual([]);
	});
});
