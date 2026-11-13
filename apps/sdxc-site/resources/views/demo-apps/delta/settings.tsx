/**
 * The repository's settings as the router reaches them: each settings page drawn from the
 * visitor's saved settings, and every form it posts answered by redirecting back with the
 * settings in a cookie, or, for a General save that can't be kept, by the form again with why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { readAppShellCookie } from "@sdxc/ui/app/app-shell";

import type { DemoAppRedirect, DemoAppRequest, DemoAppScreen } from "~/resources/views/demo-apps";

import { readTree } from "~/app/services/delta/source";

import { MAIN_FRAME } from "../main-frame";

import type { DeltaRoute } from "./data";
import type { RepoSettings } from "./prefs";
import type { SettingsDraft, SettingsPage } from "./screens/settings";

import { actionHref, buildTree } from "./data";
import { COPY } from "./labels";
import { readPrefs, settingsCookie } from "./prefs";
import { SettingsScreen } from "./screens/settings";
import { DeltaFrame, SHELL_COOKIE } from "./shell";

/** How long a toast offering Undo stays, long enough to reach for it. */
const UNDO_DURATION = 8000;

/** The toasts the settings' forms name. */
export const SETTINGS_TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	"settings-saved": { color: "success", title: COPY.settings.toasts.saved },
	"protection-saved": { color: "success", title: COPY.settings.toasts.protection },
	"repo-archived": {
		title: COPY.settings.toasts.archived,
		duration: UNDO_DURATION,
		action: {
			label: COPY.settings.toasts.undo,
			form: { action: actionHref("delta/settings/unarchive") },
		},
	},
	"repo-unarchived": { title: COPY.settings.toasts.unarchived },
	"repo-deleted": {
		title: COPY.settings.toasts.deleted,
		description: COPY.settings.toasts.deletedHint,
		duration: UNDO_DURATION,
		action: {
			label: COPY.settings.toasts.undo,
			form: { action: actionHref("delta/settings/restore") },
		},
	},
	"repo-restored": { color: "success", title: COPY.settings.toasts.restored },
};

/** A screen as Delta's router draws it. */
interface Screen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
}

/** The repository's name as titles write it. */
const REPO_NAME = `${COPY.org}/${COPY.repo}`;

/** Drafts a refused save hands to the page it redraws, by the request that draws it. */
const DRAFTS = new WeakMap<DemoAppRequest, SettingsDraft>();

/**
 * A request that draws the General page with a refused save's values and errors in the form,
 * for the answer to a save that can't be kept.
 */
function withDraft(request: DemoAppRequest, draft: SettingsDraft): DemoAppRequest {
	let drafted: DemoAppRequest = { ...request, page: "delta/settings/general" };
	DRAFTS.set(drafted, draft);
	return drafted;
}

/**
 * Draws a settings page with the visitor's saved settings, and the refused save's draft when
 * the request carries one.
 */
export function settingsScreen(
	target: Extract<DeltaRoute, { screen: "settings" }>,
	request: DemoAppRequest,
	commits: number,
): Screen {
	let { settings } = readPrefs(request.cookie);
	let page: SettingsPage = target.section ?? "index";
	let label = page === "branches" ? COPY.settings.branches.title : COPY.settings.general.title;
	return {
		title: `${label} · ${COPY.settings.title} · ${REPO_NAME}`,
		nav: "repo",
		crumb: `${REPO_NAME} › ${COPY.settings.title}`,
		body: (
			<SettingsScreen
				page={page}
				settings={settings}
				commits={commits}
				draft={DRAFTS.get(request)}
			/>
		),
	};
}

/**
 * Answers a General save that can't be kept with the General page again, its form holding
 * what was typed and why each refused field was refused: `main` alone for a post aimed at it,
 * and the whole page, `main` drawn in place, for a browser running no script.
 *
 * @param request The post.
 * @param draft What was typed, and the errors.
 * @param target The app's own `main` renderer, which wraps a screen with its manifest.
 */
export async function redrawSettings(
	request: DemoAppRequest,
	draft: SettingsDraft,
	target: (name: string, request: DemoAppRequest) => Promise<RemixNode> | RemixNode,
): Promise<DemoAppScreen> {
	let drafted = withDraft(request, draft);
	let [main, tree] = await Promise.all([target(MAIN_FRAME, drafted), readTree()]);
	let label = COPY.settings.general.title;
	return {
		title: `${label} · ${COPY.settings.title} · ${REPO_NAME}`,
		status: 400,
		frames: { [MAIN_FRAME]: main },
		body: (
			<DeltaFrame
				current="repo"
				crumb={`${REPO_NAME} › ${COPY.settings.title}`}
				collapsed={readAppShellCookie(request.cookie, SHELL_COOKIE)}
				tree={buildTree(tree.files)}
				paths={tree.files.map((file) => file.path)}
			>
				<div data-main-region="">{main}</div>
			</DeltaFrame>
		),
	};
}

/** A posted text field, trimmed, or `""` when missing. */
function field(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Reads a General save: a name of letters, digits, `.`, `-` and `_`, a description that fits
 * and a website that is a web address or nothing. Each refused field says why and what to do.
 */
function readGeneral(form: FormData): SettingsDraft {
	let values = {
		name: field(form, "name"),
		description: field(form, "description"),
		website: field(form, "website"),
	};
	let errors: SettingsDraft["errors"] = {};
	let copy = COPY.settings.general.errors;
	if (values.name === "") errors.name = copy.nameMissing;
	else if (!/^[A-Za-z0-9._-]{1,100}$/.test(values.name)) errors.name = copy.nameShape;
	if (values.description.length > 350) errors.description = copy.descriptionLong;
	if (values.website !== "" && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(values.website)) {
		errors.website = copy.website;
	}
	return { values, errors };
}

/** What a settings post asks for: a redirect, or the General form drawn again with its draft. */
export type SettingsAnswer = DemoAppRedirect | { draft: SettingsDraft };

/**
 * Answers the settings' forms: General's Save, the features' switches, the branch rule's
 * Save, and archive, delete and their Undo. Any other page answers `null`.
 *
 * @param page The page the form posted to.
 * @param form The posted fields.
 * @param request The post, whose cookies hold the visitor's settings.
 */
export function submitSettings(
	page: string,
	form: FormData,
	request: DemoAppRequest,
): SettingsAnswer | null {
	if (page !== "delta/settings" && !page.startsWith("delta/settings/")) return null;
	let { settings } = readPrefs(request.cookie);
	let save = (next: RepoSettings, back: string, toast?: string): DemoAppRedirect => ({
		page: back,
		toast,
		cookies: [settingsCookie(next)],
	});
	let intent = field(form, "intent");
	let action = page.slice("delta/settings".length).replace(/^\//, "");
	if (action === "" && intent === "general") {
		let draft = readGeneral(form);
		if (Object.keys(draft.errors).length > 0) return { draft };
		return save({ ...settings, ...draft.values }, "delta/settings/general", "settings-saved");
	}
	if (action === "" && intent === "features") {
		let flags = { issues: false, discussions: false, wiki: false, projects: false };
		for (let feature of Object.keys(flags) as Array<keyof typeof flags>) {
			flags[feature] = form.get(feature) !== null;
		}
		return save({ ...settings, ...flags }, "delta/settings/general");
	}
	if (action === "branches" && intent === "protection") {
		let reviews = Number(field(form, "reviews"));
		return save(
			{
				...settings,
				reviews:
					Number.isInteger(reviews) && reviews >= 0 && reviews <= 6 ? reviews : settings.reviews,
				checks: form.get("checks") !== null,
				linear: form.get("linear") !== null,
			},
			"delta/settings/branches",
			"protection-saved",
		);
	}
	if (action === "archive")
		return save({ ...settings, archived: true }, "delta/settings/general", "repo-archived");
	if (action === "unarchive") {
		return save({ ...settings, archived: false }, "delta/settings/general", "repo-unarchived");
	}
	if (action === "delete") {
		if (field(form, "confirmation") !== REPO_NAME) return { page: "delta/settings/general" };
		return save({ ...settings, deleted: true }, "", "repo-deleted");
	}
	if (action === "restore") return save({ ...settings, deleted: false }, "", "repo-restored");
	return null;
}
