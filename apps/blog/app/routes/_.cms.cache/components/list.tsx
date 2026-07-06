/**
 * Renders a multi-select list of cache keys for the CMS cache management route.
 * Each key becomes a toggleable GridList item with a checkbox named "key" so the
 * enclosing form can submit the selected keys for bulk cache invalidation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Checkbox, GridList } from "@pkg/ui";

interface CacheKeyListProps {
	keys: string[];
}

export function CacheKeyList({ keys }: CacheKeyListProps) {
	return (
		<GridList
			aria-label="Cache Keys"
			selectionMode="multiple"
			selectionBehavior="toggle"
			items={keys.map((key) => ({ value: key }))}
		>
			{(item) => {
				return (
					<GridList.Item key={item.value} id={item.value} textValue={item.value}>
						<Checkbox slot="selection" name="key" value={item.value} />
						{item.value}
					</GridList.Item>
				);
			}}
		</GridList>
	);
}
