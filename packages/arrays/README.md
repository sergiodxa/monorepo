# @pkg/arrays

Utility functions for common array operations with TypeScript type safety.

## Overview

This package provides a collection of small, focused utility functions for working with arrays. These functions handle common patterns like checking array contents, extracting elements, and removing duplicates.

All functions are pure (no side effects) and preserve TypeScript generics for type safety.

## Usage

```typescript
import { hasAny, isEmpty, first, last, unique, toArray, skip } from "@pkg/arrays";

let items = [1, 2, 3, 4, 5];

if (hasAny(items)) {
	console.log("First two:", first(items, 2)); // [1, 2]
	console.log("Last two:", last(items, 2)); // [4, 5]
	console.log("Skip two:", skip(items, 2)); // [3, 4, 5]
}

let tags = ["react", "typescript", "react"];
console.log(unique(tags)); // ["react", "typescript"]

let singleOrArray = "hello";
console.log(toArray(singleOrArray)); // ["hello"]
```

## API

### `hasAny<T>(list: T[]): boolean`

Check if an array has any elements.

**Parameters:**

- `list`: The array to check

**Returns:**

- `true` if the array has at least one element, `false` otherwise

**Example:**

```typescript
hasAny([1, 2, 3]); // true
hasAny([]); // false
```

### `hasMany<T>(list: T[]): boolean`

Check if an array has more than one element.

**Parameters:**

- `list`: The array to check

**Returns:**

- `true` if the array has more than one element, `false` otherwise

**Example:**

```typescript
hasMany([1, 2]); // true
hasMany([1]); // false
hasMany([]); // false
```

### `isEmpty<T>(list: T[]): boolean`

Check if an array is empty.

**Parameters:**

- `list`: The array to check

**Returns:**

- `true` if the array has no elements, `false` otherwise

**Example:**

```typescript
isEmpty([]); // true
isEmpty([1]); // false
```

### `first<T>(list: T[], limit?: number): T[]`

Get the first n items from an array.

**Parameters:**

- `list`: The source array
- `limit`: Number of items to take (default: 1)

**Returns:**

- A new array containing the first `limit` items

**Example:**

```typescript
first([1, 2, 3, 4, 5]); // [1]
first([1, 2, 3, 4, 5], 3); // [1, 2, 3]
first([1, 2], 5); // [1, 2] (returns all if limit exceeds length)
```

### `last<T>(list: T[], limit?: number): T[]`

Get the last n items from an array.

**Parameters:**

- `list`: The source array
- `limit`: Number of items to take (default: 1)

**Returns:**

- A new array containing the last `limit` items

**Example:**

```typescript
last([1, 2, 3, 4, 5]); // [5]
last([1, 2, 3, 4, 5], 3); // [3, 4, 5]
last([1, 2], 5); // [1, 2] (returns all if limit exceeds length)
```

### `unique<T>(array: T[]): T[]`

Remove duplicate values from an array. Uses `Set` internally, so only works correctly for primitives and object references.

**Parameters:**

- `array`: The array with potential duplicates

**Returns:**

- A new array with duplicates removed

**Example:**

```typescript
unique([1, 2, 2, 3, 1]); // [1, 2, 3]
unique(["a", "b", "a"]); // ["a", "b"]
```

### `toArray<T>(value: T | T[]): T[]`

Wrap a value in an array if it's not already an array.

**Parameters:**

- `value`: A single value or an array

**Returns:**

- The value wrapped in an array, or the original array if already an array

**Example:**

```typescript
toArray("hello"); // ["hello"]
toArray(["hello"]); // ["hello"]
toArray([1, 2, 3]); // [1, 2, 3]
```

### `skip<T>(list: T[], limit: number): T[]`

Skip the first n items and return the rest.

**Parameters:**

- `list`: The source array
- `limit`: Number of items to skip

**Returns:**

- A new array without the first `limit` items

**Example:**

```typescript
skip([1, 2, 3, 4, 5], 2); // [3, 4, 5]
skip([1, 2], 5); // [] (returns empty if limit exceeds length)
```

## Pattern: Pagination

Combine `first` and `skip` for manual pagination:

```typescript
import { first, skip } from "@pkg/arrays";

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
	let offset = (page - 1) * pageSize;
	return first(skip(items, offset), pageSize);
}

let items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
paginate(items, 1, 3); // [1, 2, 3]
paginate(items, 2, 3); // [4, 5, 6]
paginate(items, 3, 3); // [7, 8, 9]
```

## Pattern: Conditional Rendering

Use `hasAny` and `hasMany` for conditional rendering:

```typescript
import { hasAny, hasMany } from "@pkg/arrays";

function ItemList({ items }: { items: string[] }) {
  if (!hasAny(items)) {
    return <p>No items found</p>;
  }

  return (
    <div>
      {hasMany(items) && <p>Showing {items.length} items</p>}
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Pattern: Normalizing API Inputs

Use `toArray` to handle APIs that accept single values or arrays:

```typescript
import { toArray } from "@pkg/arrays";

function processIds(ids: string | string[]) {
	let idArray = toArray(ids);
	return idArray.map((id) => fetchItem(id));
}

// Both work:
processIds("123");
processIds(["123", "456"]);
```

## Related Packages

- [`@pkg/result`](/packages/result) - Result type for operations that can fail

## Tips

1. **Use `hasAny` over `.length > 0`** - More readable and intent is clearer
2. **`unique` uses Set** - Only works for primitives and reference equality, not deep object equality
3. **Functions return new arrays** - Original arrays are never mutated
4. **`first` and `last` are safe** - They return empty arrays if the limit exceeds the array length
