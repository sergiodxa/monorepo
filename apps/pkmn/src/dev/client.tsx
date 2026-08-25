/**
 * Browser entry for the dev tools. Renders the `remix/ui` tree client-side into
 * `#app` via `createRoot` and switches between the launcher and the tool views
 * through the History API, so navigation stays in the browser. Bundled by Bun.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { createRoot, css, on } from "remix/ui";

import { ImporterTool } from "./views/importer";
import { Launcher } from "./views/launcher";
import { MapTool } from "./views/map";
import { SpeciesTool } from "./views/species";
import { SpriteDrawingTool } from "./views/sprite";
import { TrainerTool } from "./views/trainer";

/** The client-navigable tool paths. `/` is the launcher; the rest are editors. */
export type ToolPath = "/" | "/sprite" | "/map" | "/species" | "/trainer" | "/importer";

/** Every path the client understands, used to sanitize the initial URL. */
const KNOWN_PATHS: ToolPath[] = ["/", "/sprite", "/map", "/species", "/trainer", "/importer"];

/**
 * Coerces an arbitrary pathname to a known {@link ToolPath}, falling back to the
 * launcher for anything unrecognized so a stale URL still renders the tools.
 *
 * @param pathname The current `location.pathname`.
 * @returns A known tool path.
 */
function toToolPath(pathname: string): ToolPath {
	return KNOWN_PATHS.includes(pathname as ToolPath) ? (pathname as ToolPath) : "/";
}

/**
 * Root application component. Owns the current tool path, re-renders on browser
 * back/forward (`popstate`), and exposes a `navigate` callback that pushes a
 * history entry and schedules a re-render, keeping view switches in the browser.
 *
 * @param handle Component handle used to schedule re-renders on navigation.
 * @returns The render function that maps the current path to a tool view.
 */
function App(handle: Handle<Record<string, never>>) {
	let current: ToolPath = toToolPath(window.location.pathname);

	function navigate(path: ToolPath) {
		if (path !== current) {
			current = path;
			window.history.pushState(null, "", path);
			void handle.update();
		}
	}

	window.addEventListener(
		"popstate",
		() => {
			current = toToolPath(window.location.pathname);
			void handle.update();
		},
		{ signal: handle.signal },
	);

	return () => (
		<main
			mix={css({
				boxSizing: "border-box",
				minHeight: "100vh",
				margin: 0,
				padding: "1.5rem",
				fontFamily: "system-ui, sans-serif",
				color: "#e5e7eb",
				background: "#09090b",
			})}
		>
			{current !== "/" ? (
				<button
					type="button"
					mix={[
						css({
							marginBottom: "1rem",
							padding: "0.4rem 0.75rem",
							fontFamily: "inherit",
							color: "#e5e7eb",
							background: "transparent",
							border: "1px solid #3f3f46",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => navigate("/")),
					]}
				>
					← Back to tools
				</button>
			) : null}

			{renderView(current, navigate)}
		</main>
	);
}

/**
 * Maps a tool path to its view element. Kept separate so the route table lives
 * in one place and new tools are a single-line addition.
 *
 * @param path The active tool path.
 * @param navigate Client navigation callback passed to the launcher.
 * @returns The `remix/ui` element for the active view.
 */
function renderView(path: ToolPath, navigate: (path: ToolPath) => void) {
	if (path === "/sprite") return <SpriteDrawingTool />;
	if (path === "/map") return <MapTool />;
	if (path === "/species") return <SpeciesTool />;
	if (path === "/trainer") return <TrainerTool />;
	if (path === "/importer") return <ImporterTool />;
	return <Launcher navigate={navigate} />;
}

let root = document.getElementById("app");
if (root === null) throw new ReferenceError("Missing #app root element.");

createRoot(root).render(<App />);
