/**
 * Holds every `@sdxc/ui` component and mixin to a live demo on its page and a face of its own
 * in the catalogue's grid. The lists below name the ones that predate the rule; a new export
 * joins neither, so it fails here until its demo and face exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { uiExportPreviewSlug } from "~/app/http/controllers/ui-export-show";
import { listComponents } from "~/app/services/components";
import { hasComponentFace } from "~/app/services/ui-component-face";
import { listUiExports } from "~/app/services/ui-exports";
import { fetchApp } from "~/app/test/router";
import { findPreview } from "~/resources/components/preview-registry.server";
import MixinFace from "~/resources/components/ui-export-faces/mixins";

/** Components documented before every component needed a live preview. */
const COMPONENTS_WITHOUT_PREVIEW: readonly string[] = [
	"code-tabs-sync",
	"docs-nav-tools",
	"shortcut-list",
];

/** Components documented before every component needed a face of its own. */
const COMPONENTS_WITHOUT_FACE: readonly string[] = [];

/** Mixins documented before every mixin needed a live demo. */
const MIXINS_WITHOUT_DEMO: readonly string[] = [
	"active-descendant-keys",
	"app-shell-controls",
	"aria-checked",
	"attachment-trigger",
	"auto-refresh",
	"calendar-keys",
	"carousel-controls",
	"channel-sync",
	"character-count",
	"chart-tooltip",
	"clear-field",
	"code-tabs-sync",
	"collapse-stream",
	"color-area-drag",
	"color-preview",
	"color-wheel-drag",
	"combobox-filter",
	"command-filter",
	"command-keys",
	"composer-send",
	"confirm-phrase",
	"context-menu",
	"copy-feedback",
	"copy-from-url",
	"copy-permalink",
	"copy-to-clipboard",
	"detail-sheet-keys",
	"dialog-dismiss",
	"dismiss",
	"docs-nav-tools",
	"drag-reorder",
	"drop-zone",
	"dual-range",
	"escape-link",
	"frame-refresh",
	"frame-submit",
	"grid-list-keys",
	"heading-level-fallback",
	"hotkey",
	"image-fallback",
	"keyboard-help",
	"keymap",
	"listbox-keys",
	"live-frame",
	"long-press",
	"menubar-keys",
	"menu-keys",
	"message-follow",
	"mirror-selected-option",
	"optimistic-toggle-sync",
	"otp-slots",
	"palette-controller",
	"persist",
	"press-toggle",
	"range-picker-keys",
	"range-preview",
	"resize-handle",
	"reveal-stream",
	"row-navigation",
	"save-bar-sync",
	"save-shortcut",
	"save-status-sync",
	"selection-bar-sync",
	"split-view-handle",
	"split-view-keys",
	"split-view-toggle",
	"status-strip-keys",
	"stepper",
	"stream_collapse_attribute",
	"stream_collapsed_attribute",
	"stream_current_attribute",
	"stream_end_attribute",
	"stream_hidden_attribute",
	"stream_pause_attribute",
	"stream_pending_attribute",
	"stream-target",
	"submit-on-change",
	"tab-keys",
	"table-selection",
	"theme-toggle",
	"toast-action",
	"toast-close",
	"toast-hold",
	"toast-stack",
	"toc-spy",
	"track-host-node",
	"tree-keys",
	"validate",
	"viewer-time",
	"view-transition",
	"while-live",
];

/** Mixins documented before every mixin needed a face of its own. */
const MIXINS_WITHOUT_FACE: readonly string[] = [
	"character-count",
	"collapse-stream",
	"stream_collapse_attribute",
	"stream_collapsed_attribute",
	"stream_current_attribute",
	"stream_end_attribute",
	"stream_hidden_attribute",
	"stream_pause_attribute",
	"stream_pending_attribute",
];

describe("catalogue coverage", () => {
	test("every component opens its page with a live preview", async () => {
		let missing = (await listComponents())
			.map((entry) => entry.slug)
			.filter((slug) => !findPreview(slug) && !COMPONENTS_WITHOUT_PREVIEW.includes(slug));
		expect(missing).toEqual([]);
	});

	test("every component draws a face of its own in the grid", async () => {
		let missing = (await listComponents())
			.map((entry) => entry.slug)
			.filter((slug) => !hasComponentFace(slug) && !COMPONENTS_WITHOUT_FACE.includes(slug));
		expect(missing).toEqual([]);
	});

	test("every mixin opens its page with a live demo", async () => {
		let missing = (await listUiExports("mixins"))
			.map((entry) => entry.slug)
			.filter(
				(slug) =>
					!findPreview(uiExportPreviewSlug("mixins", slug)) && !MIXINS_WITHOUT_DEMO.includes(slug),
			);
		expect(missing).toEqual([]);
	});

	test("a mixin page with a demo frames it above the reference", async () => {
		for (let entry of await listUiExports("mixins")) {
			let slug = uiExportPreviewSlug("mixins", entry.slug);
			if (!findPreview(slug)) continue;
			let body = await (await fetchApp(`/api/ui/mixins/${entry.slug}`)).text();
			expect(body, entry.slug).toContain(`"src":"/frames/previews/${slug}"`);
			expect((await fetchApp(`/frames/previews/${slug}`)).status, entry.slug).toBe(200);
		}
	});

	test("every mixin draws a face of its own in the grid", async () => {
		let missing: string[] = [];
		for (let entry of await listUiExports("mixins")) {
			let html = await renderToString(<MixinFace name={entry.name} />);
			if (html.includes('data-face="generic"') && !MIXINS_WITHOUT_FACE.includes(entry.slug)) {
				missing.push(entry.slug);
			}
		}
		expect(missing).toEqual([]);
	});

	test("Gantt answers at its own pages, and the old Roadmap pages are gone", async () => {
		expect((await fetchApp("/api/ui/gantt")).status).toBe(200);
		expect((await fetchApp("/api/ui/mixins/gantt-today")).status).toBe(200);
		expect((await fetchApp("/frames/previews/mixins-gantt-today")).status).toBe(200);
		expect((await fetchApp("/api/ui/roadmap")).status).toBe(404);
		expect((await fetchApp("/api/ui/mixins/roadmap-today")).status).toBe(404);
	});
});
