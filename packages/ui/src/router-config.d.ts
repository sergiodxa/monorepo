// Augment React Aria's RouterConfig to support React Router's navigation options
// See: https://react-spectrum.adobe.com/react-aria/routing.html

declare module "@react-types/shared" {
	export interface RouterConfig {
		routerOptions: {
			preventScrollReset?: boolean;
			replace?: boolean;
			state?: unknown;
			relative?: "route" | "path";
			flushSync?: boolean;
			viewTransition?: boolean;
		};
	}
}
