import type { Preview } from "@storybook/react";

import { RouterProvider } from "react-aria-components";
import { createRoutesStub } from "react-router";

import "./storybook.css";

// Create a routes stub for React Router integration
function RouterDecorator({ children }: { children: React.ReactNode }) {
	const Stub = createRoutesStub([
		{
			path: "*",
			Component: () => children,
		},
	]);
	return (
		<RouterProvider navigate={(to) => window.history.pushState({}, "", to)}>
			<Stub initialEntries={["/"]} />
		</RouterProvider>
	);
}

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "light",
			values: [
				{ name: "light", value: "#ffffff" },
				{ name: "dark", value: "#0a0a0a" },
			],
		},
	},
	decorators: [
		(Story) => (
			<RouterDecorator>
				<Story />
			</RouterDecorator>
		),
	],
};

export default preview;
