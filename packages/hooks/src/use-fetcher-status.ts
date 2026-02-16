import type { useFetcher } from "react-router";

import { useMemo } from "react";

type FetcherStatus = "idle" | "loading" | "success" | "failure";

export function useFetcherStatus<T extends { ok?: boolean }>(
	fetcher: ReturnType<typeof useFetcher<T>>,
): FetcherStatus {
	return useMemo(() => {
		if (fetcher.state === "submitting") return "loading";
		if (fetcher.state === "loading") return "loading";
		if (fetcher.data?.ok === false) return "failure";
		if (fetcher.data?.ok === true) return "success";
		return "idle";
	}, [fetcher.state, fetcher.data]);
}
