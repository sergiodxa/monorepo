/**
 * Myers' O((N+M)·D) shortest edit script over interned sequences, in linear space through the
 * middle-snake divide. Every comparison is charged to a shared budget, so a region that would
 * cost too much is marked as one replace block and the caller gets an answer in bounded time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The comparison steps left for one diff, shared by every algorithm that diff runs. */
export interface Budget {
	remaining: number;
	/** Set once any region was marked wholesale because the budget ran out. */
	approximate: boolean;
}

/**
 * Marks every element of `[lo, hi)` as changed. Change arrays are offset by one, so index 0 and
 * `length + 1` stay as unchanged sentinels for the compaction that runs afterwards.
 */
export function markRange(changed: Uint8Array, lo: number, hi: number): void {
	changed.fill(1, lo + 1, hi + 1);
}

/**
 * Finds a point on a minimal edit path through `a[aLo, aHi)` × `b[bLo, bHi)`, which splits the
 * problem in two halves that are each still minimal. Both ends of the region must differ.
 *
 * @returns The split as `[x, y]` offsets into the region, or `undefined` when the budget ran out.
 */
function bisect(
	a: Int32Array,
	aLo: number,
	n: number,
	b: Int32Array,
	bLo: number,
	m: number,
	vf: Int32Array,
	vb: Int32Array,
	budget: Budget,
): [number, number] | undefined {
	let maxD = (n + m + 1) >> 1;
	let offset = maxD + 1;
	vf.fill(-1, 0, 2 * offset + 2);
	vb.fill(-1, 0, 2 * offset + 2);
	vf[offset + 1] = 0;
	vb[offset + 1] = 0;
	let delta = n - m;
	let front = (delta & 1) !== 0;
	let k1start = 0;
	let k1end = 0;
	let k2start = 0;
	let k2end = 0;
	for (let d = 0; d <= maxD; d++) {
		budget.remaining -= 2 * d + 2;
		if (budget.remaining < 0) return undefined;
		for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
			let index = offset + k1;
			let x1 =
				k1 === -d || (k1 !== d && vf[index - 1]! < vf[index + 1]!)
					? vf[index + 1]!
					: vf[index - 1]! + 1;
			let y1 = x1 - k1;
			let start = x1;
			while (x1 < n && y1 < m && a[aLo + x1] === b[bLo + y1]) {
				x1++;
				y1++;
			}
			budget.remaining -= x1 - start;
			vf[index] = x1;
			if (x1 > n) {
				k1end += 2;
			} else if (y1 > m) {
				k1start += 2;
			} else if (front) {
				let reverse = offset + delta - k1;
				if (reverse >= 0 && reverse < 2 * offset && vb[reverse] !== -1) {
					if (x1 >= n - vb[reverse]!) return [x1, y1];
				}
			}
		}
		for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
			let index = offset + k2;
			let x2 =
				k2 === -d || (k2 !== d && vb[index - 1]! < vb[index + 1]!)
					? vb[index + 1]!
					: vb[index - 1]! + 1;
			let y2 = x2 - k2;
			let start = x2;
			while (x2 < n && y2 < m && a[aLo + n - x2 - 1] === b[bLo + m - y2 - 1]) {
				x2++;
				y2++;
			}
			budget.remaining -= x2 - start;
			vb[index] = x2;
			if (x2 > n) {
				k2end += 2;
			} else if (y2 > m) {
				k2start += 2;
			} else if (!front) {
				let forward = offset + delta - k2;
				if (forward >= 0 && forward < 2 * offset && vf[forward] !== -1) {
					let x1 = vf[forward]!;
					let y1 = offset + x1 - forward;
					if (x1 >= n - x2) return [x1, y1];
				}
			}
		}
	}
	return undefined;
}

/**
 * Marks a minimal set of changed elements in `a[aLo, aHi)` and `b[bLo, bHi)`. Regions are kept
 * on an explicit stack, so the call stack stays flat for any input shape.
 */
export function myers(
	a: Int32Array,
	aLo: number,
	aHi: number,
	b: Int32Array,
	bLo: number,
	bHi: number,
	changedA: Uint8Array,
	changedB: Uint8Array,
	budget: Budget,
): void {
	let size = aHi - aLo + (bHi - bLo);
	let vf = new Int32Array(size + 6);
	let vb = new Int32Array(size + 6);
	let stack = [aLo, aHi, bLo, bHi];
	while (stack.length > 0) {
		let y1 = stack.pop()!;
		let y0 = stack.pop()!;
		let x1 = stack.pop()!;
		let x0 = stack.pop()!;
		while (x0 < x1 && y0 < y1 && a[x0] === b[y0]) {
			x0++;
			y0++;
		}
		while (x0 < x1 && y0 < y1 && a[x1 - 1] === b[y1 - 1]) {
			x1--;
			y1--;
		}
		if (x0 === x1 || y0 === y1) {
			markRange(changedA, x0, x1);
			markRange(changedB, y0, y1);
			continue;
		}
		let split =
			budget.remaining > 0 ? bisect(a, x0, x1 - x0, b, y0, y1 - y0, vf, vb, budget) : undefined;
		if (split === undefined) {
			budget.approximate = true;
			markRange(changedA, x0, x1);
			markRange(changedB, y0, y1);
			continue;
		}
		let [sx, sy] = split;
		stack.push(x0 + sx, x1, y0 + sy, y1, x0, x0 + sx, y0, y0 + sy);
	}
}

/**
 * Runs `myers` on `a[aLo, aHi)` × `b[bLo, bHi)` after setting aside the elements that occur on
 * one side only: they are certain changes, so they are marked outright and the search runs on
 * what is left. `seen` is scratch space indexed by element id, all zero on entry and on exit.
 */
export function myersDiscarding(
	a: Int32Array,
	aLo: number,
	aHi: number,
	b: Int32Array,
	bLo: number,
	bHi: number,
	changedA: Uint8Array,
	changedB: Uint8Array,
	budget: Budget,
	seen: Uint8Array,
): void {
	for (let j = bLo; j < bHi; j++) seen[b[j]!] = 1;
	for (let i = aLo; i < aHi; i++) seen[a[i]!]! |= 2;
	let keptA = new Int32Array(aHi - aLo);
	let idsA = new Int32Array(aHi - aLo);
	let countA = 0;
	for (let i = aLo; i < aHi; i++) {
		let id = a[i]!;
		if (seen[id]! & 1) {
			keptA[countA] = i;
			idsA[countA++] = id;
		} else {
			changedA[i + 1] = 1;
		}
	}
	let keptB = new Int32Array(bHi - bLo);
	let idsB = new Int32Array(bHi - bLo);
	let countB = 0;
	for (let j = bLo; j < bHi; j++) {
		let id = b[j]!;
		if (seen[id]! & 2) {
			keptB[countB] = j;
			idsB[countB++] = id;
		} else {
			changedB[j + 1] = 1;
		}
	}
	for (let j = bLo; j < bHi; j++) seen[b[j]!] = 0;
	for (let i = aLo; i < aHi; i++) seen[a[i]!] = 0;
	if (countA === 0 || countB === 0) {
		for (let i = 0; i < countA; i++) changedA[keptA[i]! + 1] = 1;
		for (let j = 0; j < countB; j++) changedB[keptB[j]! + 1] = 1;
		return;
	}
	let reducedA = new Uint8Array(countA + 2);
	let reducedB = new Uint8Array(countB + 2);
	myers(idsA, 0, countA, idsB, 0, countB, reducedA, reducedB, budget);
	for (let i = 0; i < countA; i++) if (reducedA[i + 1]) changedA[keptA[i]! + 1] = 1;
	for (let j = 0; j < countB; j++) if (reducedB[j + 1]) changedB[keptB[j]! + 1] = 1;
}
