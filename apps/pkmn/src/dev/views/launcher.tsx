/**
 * Launcher view for the dev tools. Lists the four editor tools as client-side
 * navigation buttons (no server round-trip) and hosts a "test export" button
 * that POSTs to the export action to prove the disk-write path works end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on } from "remix/ui";

import type { ToolPath } from "../client";

/** A single tool entry rendered as a navigation button on the launcher. */
interface ToolLink {
	path: ToolPath;
	label: string;
	description: string;
}

/** The four editor tools the launcher links to. */
const TOOLS: ToolLink[] = [
	{ path: "/sprite", label: "Sprite", description: "Draw and edit sprite sheets." },
	{ path: "/map", label: "Map", description: "Compose tile maps." },
	{ path: "/species", label: "Species", description: "Author species content." },
	{ path: "/trainer", label: "Trainer", description: "Author trainer content." },
	{ path: "/importer", label: "Importer", description: "Import a PNG as a sliced atlas." },
];

/** Props for the launcher: a client-side navigation callback. */
export interface LauncherProps {
	navigate: (path: ToolPath) => void;
}

/**
 * Renders the tool list and the export smoke-test button. Navigation buttons
 * switch views client-side via {@link LauncherProps.navigate}; the export button
 * posts a tiny payload to the server action and reports the outcome inline.
 *
 * @param handle Component handle carrying the navigation callback.
 * @returns The render function for the launcher view.
 */
export function Launcher(handle: Handle<LauncherProps>) {
	// Local state for the export smoke test, surfaced back into the UI on update.
	let exportStatus = "";

	/** Posts a tiny file to the export action and records the result for display. */
	async function runExportSmokeTest() {
		exportStatus = "Exporting…";
		void handle.update();

		let response = await fetch("/dev/export", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				path: "src/content/__dev_export_probe__/probe.json",
				contents: JSON.stringify({ ok: true, at: new Date().toISOString() }, null, "\t"),
			}),
		});

		let body = (await response.json()) as { path?: string; error?: string };
		exportStatus = response.ok
			? `Wrote ${body.path}`
			: `Export failed: ${body.error ?? response.statusText}`;
		void handle.update();
	}

	return () => (
		<section mix={css({ display: "grid", gap: "1.5rem" })}>
			<header mix={css({ display: "grid", gap: "0.25rem" })}>
				<h1 mix={css({ margin: 0, fontSize: "1.5rem" })}>Dev Tools</h1>
				<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.9rem" })}>
					In-game developer tools. Pick an editor to get started.
				</p>
			</header>

			<ul
				mix={css({
					listStyle: "none",
					margin: 0,
					padding: 0,
					display: "grid",
					gap: "0.75rem",
					gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
				})}
			>
				{TOOLS.map((tool) => (
					<li key={tool.path}>
						<button
							type="button"
							mix={[
								css({
									width: "100%",
									textAlign: "left",
									display: "grid",
									gap: "0.25rem",
									padding: "0.9rem 1rem",
									fontFamily: "inherit",
									color: "#e5e7eb",
									background: "#18181b",
									border: "1px solid #3f3f46",
									borderRadius: "0.5rem",
									cursor: "pointer",
									"&:hover": { borderColor: "#6366f1" },
								}),
								on<HTMLButtonElement, "click">("click", () => handle.props.navigate(tool.path)),
							]}
						>
							<span mix={css({ fontWeight: "600" })}>{tool.label}</span>
							<span mix={css({ fontSize: "0.8rem", color: "#9ca3af" })}>{tool.description}</span>
						</button>
					</li>
				))}
			</ul>

			<footer mix={css({ display: "grid", gap: "0.5rem", justifyItems: "start" })}>
				<button
					type="button"
					mix={[
						css({
							padding: "0.6rem 0.9rem",
							fontFamily: "inherit",
							color: "#052e16",
							background: "#4ade80",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => void runExportSmokeTest()),
					]}
				>
					Test export
				</button>
				{exportStatus ? (
					<p mix={css({ margin: 0, fontSize: "0.85rem", color: "#a1a1aa" })}>{exportStatus}</p>
				) : null}
			</footer>
		</section>
	);
}
