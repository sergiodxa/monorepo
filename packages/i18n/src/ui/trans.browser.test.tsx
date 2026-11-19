/**
 * Holds `Trans` to its markup-options contract in a real browser: options reach a spliced-in
 * element as attributes or props it leaves unset, a component entry receives them with the
 * markup's name and content, and reserved or non-string values follow the documented rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { Handle, RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createElement } from "remix/component";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { createI18n } from "../lib/i18n.js";

import { Trans } from "./trans.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Messages whose markup carries literal, variable and `u:id` options. */
const MESSAGES = {
	link: "See {#link href=$url title=|The docs|}docs{/link}",
	speed: "Now {#speed rate=10}fast{/speed} again",
	pause: "Wait{#pause ms=400/} for it",
	counted: "{#meter value=$count max=$total/}",
	flagged: "{#box hidden=$hidden data-meta=$meta/}",
	identified: "{#b u:id=intro}Hi{/b}",
	conflict: "{#link href=|https://evil.example| class=fromMessage}x{/link}",
	reserved: "{#b onclick=|alert(1)| key=k mix=m}x{/b}",
	nested: "{#outer level=1}a {#inner level=2}b{/inner}{/outer}",
};

/** Builds an English translator over {@link MESSAGES}, collecting reported errors. */
function make(errors: string[] = []) {
	return createI18n({
		locale: "en",
		fallbackLanguage: "en",
		resources: { en: MESSAGES },
		onError: (error, key) => errors.push(`${key}: ${error.message}`),
	});
}

/** Mounts `node`, keeping the result for cleanup. */
function mount(node: RemixNode): RenderResult {
	mounted = render(node);
	return mounted;
}

/** Renders a markup as a `span` that lists its name, options and content in data attributes. */
function Probe(handle: Handle<Trans.MarkupProps>) {
	return () => (
		<span data-name={handle.props.name} data-options={JSON.stringify(handle.props.options)}>
			{handle.props.children}
		</span>
	);
}

/** A component element that echoes the `rate` prop it receives and the type it arrives as. */
function Rate(handle: Handle<{ rate?: unknown; children?: RemixNode }>) {
	return () => (
		<em data-rate={String(handle.props.rate)} data-type={typeof handle.props.rate}>
			{handle.props.children}
		</em>
	);
}

describe("Trans markup options", () => {
	test("sets literal and variable options as attributes on a host element", () => {
		let result = mount(
			<Trans
				intl={make()}
				i18nKey="link"
				values={{ url: "/docs" }}
				components={{ link: createElement("a", { class: "doc" }) }}
			/>,
		);

		let link = result.$("a")!;
		expect(link.getAttribute("href")).toBe("/docs");
		expect(link.getAttribute("title")).toBe("The docs");
		expect(link.className).toBe("doc");
		expect(link.textContent).toBe("docs");
		expect(result.container.textContent).toBe("See docs");
	});

	test("passes a paired markup's literal option to a component element as a string prop", () => {
		let result = mount(<Trans intl={make()} i18nKey="speed" components={{ speed: <Rate /> }} />);

		let em = result.$("em")!;
		expect(em.dataset.rate).toBe("10");
		expect(em.dataset.type).toBe("string");
		expect(em.textContent).toBe("fast");
	});

	test("passes a standalone markup's options to a component entry", () => {
		let result = mount(<Trans intl={make()} i18nKey="pause" components={{ pause: Probe }} />);

		let probe = result.$("[data-name]")!;
		expect(probe.dataset.name).toBe("pause");
		expect(JSON.parse(probe.dataset.options!)).toEqual({ ms: "400" });
		expect(probe.textContent).toBe("");
		expect(result.container.textContent).toBe("Wait for it");
	});

	test("hands a component entry the paired markup's content as children", () => {
		let result = mount(<Trans intl={make()} i18nKey="speed" components={{ speed: Probe }} />);

		let probe = result.$("[data-name]")!;
		expect(probe.dataset.name).toBe("speed");
		expect(JSON.parse(probe.dataset.options!)).toEqual({ rate: "10" });
		expect(probe.textContent).toBe("fast");
	});

	test("keeps a numeric variable's value as a number for components and attributes", () => {
		let probe = mount(
			<Trans
				intl={make()}
				i18nKey="counted"
				values={{ count: 3, total: 10 }}
				components={{ meter: Probe }}
			/>,
		);
		expect(JSON.parse(probe.$("[data-name]")!.dataset.options!)).toEqual({ value: 3, max: 10 });
		mounted?.cleanup();

		let host = mount(
			<Trans
				intl={make()}
				i18nKey="counted"
				values={{ count: 3, total: 10 }}
				components={{ meter: <meter /> }}
			/>,
		);
		let meter = host.$("meter") as HTMLMeterElement;
		expect(meter.value).toBe(3);
		expect(meter.max).toBe(10);
	});

	test("renders booleans as the renderer does and other values as their string", () => {
		let shown = mount(
			<Trans
				intl={make()}
				i18nKey="flagged"
				values={{ hidden: false, meta: { toString: () => "meta" } }}
				components={{ box: <div /> }}
			/>,
		);
		expect(shown.$("div")!.hasAttribute("hidden")).toBe(false);
		expect(shown.$("div")!.dataset.meta).toBe("meta");
		mounted?.cleanup();

		let hidden = mount(
			<Trans
				intl={make()}
				i18nKey="flagged"
				values={{ hidden: true, meta: "m" }}
				components={{ box: <div /> }}
			/>,
		);
		expect(hidden.$("div")!.hasAttribute("hidden")).toBe(true);
	});

	test("delivers the u:id option as id", () => {
		let host = mount(<Trans intl={make()} i18nKey="identified" components={{ b: <b /> }} />);
		expect(host.$("b")!.id).toBe("intro");
		mounted?.cleanup();

		let probe = mount(<Trans intl={make()} i18nKey="identified" components={{ b: Probe }} />);
		expect(JSON.parse(probe.$("[data-name]")!.dataset.options!)).toEqual({ id: "intro" });
	});

	test("keeps the element's own props over options of the same name", () => {
		let result = mount(
			<Trans
				intl={make()}
				i18nKey="conflict"
				components={{ link: createElement("a", { href: "/safe", class: "mine" }) }}
			/>,
		);

		let link = result.$("a")!;
		expect(link.getAttribute("href")).toBe("/safe");
		expect(link.className).toBe("mine");
	});

	test("never sets event handlers or renderer props on a host element", () => {
		let result = mount(<Trans intl={make()} i18nKey="reserved" components={{ b: <b /> }} />);

		let bold = result.$("b")!;
		expect(bold.hasAttribute("onclick")).toBe(false);
		expect(bold.hasAttribute("key")).toBe(false);
		expect(bold.hasAttribute("mix")).toBe(false);
		expect(bold.textContent).toBe("x");
	});

	test("gives each nested markup its own options", () => {
		let result = mount(
			<Trans intl={make()} i18nKey="nested" components={{ outer: <section />, inner: <span /> }} />,
		);

		expect(result.$("section")!.getAttribute("level")).toBe("1");
		expect(result.$("section span")!.getAttribute("level")).toBe("2");
		expect(result.$("section")!.textContent).toBe("a b");
	});

	test("keeps the attributes an element sets beside the options it adds", () => {
		let errors: string[] = [];
		let result = mount(
			<Trans
				intl={make(errors)}
				i18nKey="speed"
				components={{ speed: <span data-novel-speed="0.5" /> }}
			/>,
		);

		let span = result.$("span")!;
		expect(span.dataset.novelSpeed).toBe("0.5");
		expect(span.getAttribute("rate")).toBe("10");
		expect(errors).toEqual([]);
	});
});
