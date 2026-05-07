import type { RemixNode } from "remix/ui";

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		children: RemixNode;
		title?: string;
	}
}

export default function DocumentLayout() {
	return (props: DocumentLayout.Props) => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				{props.title && <title>{props.title}</title>}
				<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
			</head>
			<body>
				{props.children}
				<script type="module" src={CLIENT_ENTRY_SRC}></script>
			</body>
		</html>
	);
}
