/**
 * Client entry point that hydrates the server-rendered document with React
 * Router's HydratedRouter, wrapping hydration in startTransition and StrictMode
 * so the browser takes over the SSR markup without blocking the main thread.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<HydratedRouter />
		</StrictMode>,
	);
});
