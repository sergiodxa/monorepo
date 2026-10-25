/**
 * Parses and evaluates the DNS policies that authenticate a domain's email: DMARC with its
 * Tree Walk and aggregate reports, SPF's `check_host()`, MTA-STS, TLS-RPT and DKIM key
 * records. Lookups go through DNS-over-HTTPS, so every check runs in a Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DKIM } from "./dkim.js";
export type { DMARC } from "./dmarc.js";
export type { DMARCReport } from "./dmarc-report.js";
export type { EmailAuthProtocol } from "./errors.js";
export type { LookupOptions } from "./lookup.js";
export type { MTASTS, PolicyFetchFailure } from "./mta-sts.js";
export type { SpfAnalysis, SpfProblem } from "./spf/analyze.js";
export type { CheckHostInput, CheckHostOptions, SpfEvaluation } from "./spf/check-host.js";
export type { SPF } from "./spf/record.js";
export type { TLSRPT } from "./tls-rpt.js";

export { lookupDkimKey, parseDkimRecord } from "./dkim.js";
export {
	appliedDmarcPolicy,
	discoverDmarc,
	dmarcTreeWalk,
	findOrganizationalDomain,
	isAligned,
	isDmarcRecord,
	parseDmarcRecord,
	selectOrganizationalDomain,
	walkDmarcTree,
} from "./dmarc.js";
export { DMARC_REPORT_NAMESPACE, parseDmarcReport } from "./dmarc-report.js";
export { RecordParseError } from "./errors.js";
export {
	discoverMtaSts,
	fetchMtaStsPolicy,
	isMtaStsRecord,
	matchesMxPattern,
	mtaStsPolicyUrl,
	parseMtaStsPolicy,
	parseMtaStsRecord,
	PolicyFetchError,
} from "./mta-sts.js";
export { analyzeSpf } from "./spf/analyze.js";
export { checkHost } from "./spf/check-host.js";
export { isSpfRecord, parseSpfRecord } from "./spf/record.js";
export { discoverTlsRpt, isTlsRptRecord, parseTlsRptRecord } from "./tls-rpt.js";
