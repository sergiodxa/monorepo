import type { StorybookConfig } from "@storybook/react-vite";

import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-a11y"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	typescript: {
		reactDocgen: "react-docgen-typescript",
	},
	viteFinal: async (config) => {
		config.plugins = [...(config.plugins || []), tailwindcss()];
		return {
			...config,
			resolve: {
				...config.resolve,
				alias: {
					...config.resolve?.alias,
					"@pkg/cn": new URL("../../cn/src/index.ts", import.meta.url).pathname,
					"@pkg/ui": new URL("../src/index.ts", import.meta.url).pathname,
				},
			},
		};
	},
};

export default config;
