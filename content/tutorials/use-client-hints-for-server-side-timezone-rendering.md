---
title: How to Use Client Hints for Server-Side Timezone Rendering
excerpt: Render dates in the user's timezone on the server using client hints and cookies.
technologies: react-router@7.0.0 @epic-web/client-hints@1.3.8
---

When building applications that display dates and times, you often need to show them in the user's local timezone. The challenge is that the server doesn't know the user's timezone when rendering the initial HTML. This leads to a common problem: either you render dates in UTC and fix them on the client (causing a flash of incorrect content), or you skip server rendering entirely and show a loading state.

Client hints solve this by storing the user's timezone in a cookie on their first visit. On subsequent requests, the server reads the cookie and renders dates correctly from the start. This [cookie persistence pattern](/tutorials/persist-the-user-locale-using-cookies-with-remix-i18next) is similar to how you'd store locale preferences. The `@epic-web/client-hints` package makes this pattern easy to implement in React Router.

## Install the Client Hints Package

First, install the `@epic-web/client-hints` package:

```txt
npm install @epic-web/client-hints
```

This package provides utilities for reading and setting client hints via cookies, along with a script that detects the user's timezone and stores it automatically.

## Create the Client Hints Utility

Create a utility file that configures the hints you want to track. For timezone detection, use the built-in `timeZone` hint:

```tsx {% path="app/utils/client-hints.tsx" %}
import { getHintUtils } from "@epic-web/client-hints";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";
import { useRouteLoaderData } from "react-router";

import type { loader } from "~/root";

let hintsUtils = getHintUtils({ timeZone: timeZoneHint });

export const { getHints } = hintsUtils;

export function ClientHintCheck({ nonce }: { nonce: string }) {
	return (
		<script
			nonce={nonce}
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}

export function useHints() {
	return useRouteLoaderData<typeof loader>("root")?.hints;
}
```

The `getHintUtils` function creates two things: a `getHints` function to read hints from the request cookies, and a `getClientHintCheckScript` function that generates JavaScript to detect and store the user's timezone.

The `ClientHintCheck` component renders an inline script that runs before React hydrates. It checks if the stored timezone matches the user's current timezone and reloads the page if they differ.

The `useHints` hook provides access to the hints from any component in your app.

## Add the Loader to Read Hints

In your root route, use `getHints` to read the timezone from the request cookies:

```tsx {% path="app/root.tsx" %}
import { ClientHintCheck, getHints } from "~/utils/client-hints";

import type { Route } from "./+types/root";

export async function loader({ request }: Route.LoaderArgs) {
	let hints = getHints(request);
	return { hints, nonce: crypto.randomUUID() };
}
```

The `getHints` function parses the client hints cookie and returns an object with the detected values. If the cookie doesn't exist yet (first visit), it returns default values.

The nonce is used for Content Security Policy compliance, ensuring the inline script can execute safely.

## Render the Client Hint Script

Add the `ClientHintCheck` component to your root component. It must render inside the `<body>` but before any content that depends on the hints:

```tsx {% path="app/root.tsx" %}
export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<>
			<ClientHintCheck nonce={loaderData.nonce} />
			<Outlet />
		</>
	);
}
```

The script runs immediately when the page loads. On the user's first visit, it detects their timezone, stores it in a cookie, and reloads the page. On subsequent visits, the cookie already exists, so no reload happens.

## Use the Timezone in Your Components

Now you can access the user's timezone anywhere in your app using the `useHints` hook:

```tsx {% path="app/routes/dashboard.tsx" %}
import { useHints } from "~/utils/client-hints";

export default function Dashboard() {
	let hints = useHints();

	let date = new Date();
	let formatted = date.toLocaleString("en-US", {
		timeZone: hints?.timeZone,
		dateStyle: "full",
		timeStyle: "short",
	});

	return <p>Current time: {formatted}</p>;
}
```

The timezone is available on both the server and client, so the rendered HTML already contains the correctly formatted date. No flash of incorrect content, no loading states.

## Format Dates in Loaders

For even better performance, format dates directly in your loaders. This keeps the formatting logic on the server and reduces the JavaScript sent to the client:

```tsx {% path="app/routes/events.tsx" %}
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/events";

export async function loader({ request }: Route.LoaderArgs) {
	let hints = getHints(request);
	let events = await getEvents();

	return {
		events: events.map((event) => ({
			...event,
			formattedDate: event.date.toLocaleString("en-US", {
				timeZone: hints.timeZone,
				dateStyle: "medium",
				timeStyle: "short",
			}),
		})),
	};
}

export default function Events({ loaderData }: Route.ComponentProps) {
	return (
		<ul>
			{loaderData.events.map((event) => (
				<li key={event.id}>
					{event.name}: {event.formattedDate}
				</li>
			))}
		</ul>
	);
}
```

This approach moves all date formatting to the server, where you have full access to the user's timezone from the first render.

## Handle the First Visit Reload

On the user's very first visit, the client hints script will detect their timezone, set the cookie, and reload the page. This reload is necessary because the server needs the cookie to render dates correctly.

The reload only happens once per browser. After that, the cookie persists and the server always knows the user's timezone.

If you want to avoid the reload entirely, you can render dates in UTC on the first visit and update them on the client after hydration. However, this creates a flash of incorrect content, which is often worse than a single reload.

## Final Thoughts

Client hints provide a clean solution for server-side timezone rendering. The pattern works well for any client-specific data you need on the server: color scheme preferences, reduced motion settings, or device capabilities. If you're building a multilingual app, combine this with [i18n setup](/tutorials/add-i18n-to-a-remix-vite-app) to handle both locale and timezone correctly. The `@epic-web/client-hints` package handles the cookie management and detection script, letting you focus on using the data in your app.
