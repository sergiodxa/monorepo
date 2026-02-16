import { GridList } from "@pkg/ui";

interface Redirect {
	from: string;
	to: string;
}

export function RedirectsList({ list }: { list: Redirect[] }) {
	return (
		<GridList aria-label="Redirects" selectionMode="multiple">
			{list.map((redirect) => {
				return (
					<GridList.Item
						key={redirect.from + redirect.to}
						textValue={`From: ${redirect.from} To: ${redirect.to}`}
					>
						From: {redirect.from} - To: {redirect.to}
					</GridList.Item>
				);
			})}
		</GridList>
	);
}
