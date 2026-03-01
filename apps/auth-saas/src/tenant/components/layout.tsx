import type { RemixNode } from "remix/component";

interface Props {
	children: RemixNode;
}

export function Layout() {
	return ({ children }: Props) => (
		<html lang="en">
			<head>
				<title>Auth SaaS</title>
			</head>
			<body>{children}</body>
		</html>
	);
}
