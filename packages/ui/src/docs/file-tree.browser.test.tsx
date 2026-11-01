/**
 * Mounts a file tree in a real browser and checks that directories fold through native
 * `<details>` with their folder icon following the state, that files pick icons by type,
 * the highlighted file reads as a pill, and a deep path scrolls inside the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { FileTree } from "./file-tree.js";

import "../reset.css";
import "../theme.css";

/** Tone colours set on the host, because an app's palette, not the package, defines them. */
const TONE_INKS: Record<string, string> = {
	"--ui-brand-bg-tint": "rgb(239, 246, 255)",
	"--ui-brand-fg-emphasis": "rgb(30, 58, 138)",
	"--ui-neutral-fg-emphasis": "rgb(23, 23, 23)",
	"--ui-neutral-fg-muted": "rgb(115, 115, 115)",
};

/** Mounts a node in a column of the given width. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	for (let [name, value] of Object.entries(TONE_INKS)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** A small app layout: one open and one folded directory, a highlight, a comment and a gap. */
const NODES: FileTree.Entry[] = [
	{
		name: "app",
		children: [
			{ name: "routes.ts", highlight: true, comment: "every URL the app serves" },
			{ name: "controllers", children: [{ name: "home.tsx" }, "…"] },
		],
	},
	{ name: "database", collapsed: true, children: [{ name: "schema.sql" }] },
	{ name: "commands", children: [] },
	{ name: "package.json" },
	{ name: "README.md" },
];

/** Every directory's `<details>`, keyed by the directory's name. */
function directories(root: HTMLElement): Map<string, HTMLDetailsElement> {
	let map = new Map<string, HTMLDetailsElement>();
	for (let details of root.querySelectorAll("details")) {
		let name = details.querySelector('summary [data-slot="file-tree-name"]')!.textContent!;
		map.set(name, details);
	}
	return map;
}

/** Whether an element is rendered visibly, counting a closed `<details>` as hiding its content. */
function isShown(element: Element): boolean {
	return element.checkVisibility({ contentVisibilityAuto: true });
}

describe("FileTree", () => {
	test("names the tree's list and renders directories as details, open unless collapsed", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} />);
		let dirs = directories(root);

		expect(root.querySelector("ul")!.getAttribute("aria-label")).toBe("Project layout");
		expect([...dirs.keys()]).toEqual(["app", "controllers", "database", "commands"]);
		expect(dirs.get("app")!.open).toBe(true);
		expect(dirs.get("database")!.open).toBe(false);
	});

	test("hides a directory's entries when its summary is clicked, and swaps the folder icon", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} />);
		let app = directories(root).get("app")!;
		let routes = [...app.querySelectorAll('[data-slot="file-tree-name"]')].find(
			(name) => name.textContent === "routes.ts",
		)!;
		let summary = app.querySelector("summary")!;
		let closedIcon = summary.querySelector('[data-slot="file-tree-folder-closed"]')!;
		let openIcon = summary.querySelector('[data-slot="file-tree-folder-open"]')!;

		expect(isShown(routes)).toBe(true);
		expect(isShown(openIcon)).toBe(true);
		expect(isShown(closedIcon)).toBe(false);

		summary.click();

		expect(app.open).toBe(false);
		expect(isShown(routes)).toBe(false);
		expect(isShown(openIcon)).toBe(false);
		expect(isShown(closedIcon)).toBe(true);
	});

	test("keeps a folded child directory's icon closed while its parent is open", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} />);
		let database = directories(root).get("database")!;

		expect(isShown(database.querySelector('[data-slot="file-tree-folder-closed"]')!)).toBe(true);
		expect(isShown(database.querySelector('[data-slot="file-tree-folder-open"]')!)).toBe(false);
	});

	test("draws the highlighted file as a filled pill and its comment in muted text", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} />);
		let pill = root.querySelector("[data-highlight]")!;
		let plain = [...root.querySelectorAll('[data-slot="file-tree-name"]')].find(
			(name) => name.textContent === "package.json",
		)!;
		let comment = root.querySelector('[data-slot="file-tree-comment"]')!;

		expect(pill.textContent).toBe("routes.ts");
		expect(getComputedStyle(pill).borderRadius).not.toBe("0px");
		expect(getComputedStyle(pill).backgroundColor).not.toBe(
			getComputedStyle(plain).backgroundColor,
		);
		expect(comment.textContent).toBe("every URL the app serves");
		expect(getComputedStyle(comment).color).not.toBe(getComputedStyle(plain).color);
	});

	test("picks a different icon for code, JSON and Markdown files", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} />);
		let iconOf = (file: string) =>
			[...root.querySelectorAll('[data-slot="file-tree-file"]')]
				.find((row) => row.textContent!.startsWith(file))!
				.querySelector("svg")!.innerHTML;

		let icons = new Set([iconOf("routes.ts"), iconOf("package.json"), iconOf("README.md")]);
		expect(icons.size).toBe(3);
	});

	test("renders the placeholder with its accessible label", () => {
		let root = mount(<FileTree aria-label="Project layout" nodes={NODES} moreLabel="More files" />);
		let more = root.querySelector('[data-slot="file-tree-more"]')!;

		expect(more.tagName).toBe("LI");
		expect(more.getAttribute("aria-label")).toBe("More files");
		expect(more.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
	});

	test("keeps a deep path on one line and scrolls it inside the card at 320px", () => {
		let deep: FileTree.Entry[] = [
			{
				name: "packages",
				children: [
					{
						name: "kit",
						children: [
							{
								name: "templates",
								children: [{ name: "a-very-long-generated-controller-file-name.browser.test.tsx" }],
							},
						],
					},
				],
			},
		];
		let root = mount(<FileTree aria-label="Project layout" nodes={deep} />, 320);
		let card = root.querySelector('[data-slot="file-tree"]')!;
		let rows = [...root.querySelectorAll('[data-slot="file-tree-row"]')];
		let last = rows.at(-1)!;

		expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(root.scrollWidth).toBeLessThanOrEqual(320);
		expect(card.scrollWidth).toBeGreaterThan(card.clientWidth);
		expect(last.getClientRects()).toHaveLength(1);
		expect(last.getBoundingClientRect().height).toBeLessThan(30);
	});
});
