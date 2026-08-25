/**
 * Imports subjects exported from the legacy IdP into an auth-saas tenant,
 * preserving each subject id so the OIDC `sub` stays stable and client apps
 * keep their local `subject_id` links. Idempotent: rows that already exist
 * (HTTP 409) are skipped, so it's safe to re-run before cutover. The empty
 * export below makes this an ES module, so its top-level `await` is legal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export {};

interface SourceSubject {
	id: string;
	email_address: string;
	email_verified_at: string | number | null;
	display_name: string | null;
	avatar: string | null;
	username: string | null;
}

function toIso(value: string | number | null): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return new Date(value).toISOString();
	if (/^\d+$/.test(value)) return new Date(Number(value)).toISOString();
	return value;
}

/**
 * Accepts rows as a plain array or as the `[{ results: [...] }]` shape that
 * `wrangler d1 --json` output uses.
 */
async function main() {
	let issuer = process.env.ISSUER;
	let clientId = process.env.CLIENT_ID;
	let clientSecret = process.env.CLIENT_SECRET;
	let inputPath = process.argv[2];

	if (!issuer || !clientId || !clientSecret || !inputPath) {
		console.error(
			"Usage: ISSUER=... CLIENT_ID=... CLIENT_SECRET=... bun run scripts/import-subjects.ts <export.json>",
		);
		process.exit(1);
	}

	let raw = JSON.parse(await Bun.file(inputPath).text()) as
		| SourceSubject[]
		| Array<{ results: SourceSubject[] }>;
	let rows: SourceSubject[] = Array.isArray(raw)
		? "results" in (raw[0] ?? {})
			? (raw as Array<{ results: SourceSubject[] }>).flatMap((page) => page.results)
			: (raw as SourceSubject[])
		: [];

	let tokenResponse = await fetch(`${issuer}/oauth/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
		},
		body: new URLSearchParams({ grant_type: "client_credentials" }),
	});
	if (!tokenResponse.ok) {
		console.error(`Failed to obtain token: ${tokenResponse.status} ${await tokenResponse.text()}`);
		process.exit(1);
	}
	let { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

	let imported = 0;
	let skipped = 0;
	let failed = 0;

	for (let row of rows) {
		let email = row.email_address;
		let payload = {
			id: row.id,
			email,
			username: row.username ?? email.split("@")[0] ?? email,
			emailVerifiedAt: toIso(row.email_verified_at),
			displayName: row.display_name,
			avatarUrl: row.avatar,
		};

		let response = await fetch(`${issuer}/api/subjects`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			imported++;
		} else if (response.status === 409) {
			skipped++;
		} else {
			failed++;
			console.error(`Failed to import ${row.id}: ${response.status} ${await response.text()}`);
		}
	}

	console.log(
		`Done. Imported ${imported}, skipped ${skipped} (already present), failed ${failed}, of ${rows.length} total.`,
	);
	if (failed > 0) process.exit(1);
}

await main();
