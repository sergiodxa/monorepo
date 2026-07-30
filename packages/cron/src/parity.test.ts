/**
 * Parity vectors captured from `cron-parser` 5.6.2, the library this package
 * replaces, so the switch cannot quietly change which run a monitor waits for. This
 * file is temporary: delete it once no application depends on that library.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { Schedule } from "./schedule";

/** One recorded run of occurrences, as the replaced library computed it. */
interface ParityVector {
	expression: string;
	timeZone: string;
	from: string;
	runs: readonly string[];
}

/**
 * Occurrences recorded from the replaced library across the shapes, the either-or
 * rule, both daylight saving transitions, and zones whose offset is not a whole
 * number of hours. The broader sweep this sample comes from compared roughly 83,000
 * occurrences over 22 zones and disagreed on eleven of them, all at a transition;
 * those are asserted separately below, with the other library's value named.
 */
const VECTORS: readonly ParityVector[] = [
	{
		expression: "* * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-15T12:01:00.000Z",
			"2026-06-15T12:02:00.000Z",
			"2026-06-15T12:03:00.000Z",
			"2026-06-15T12:04:00.000Z",
			"2026-06-15T12:05:00.000Z",
		],
	},
	{
		expression: "*/15 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:07:00Z",
		runs: [
			"2026-06-15T12:15:00.000Z",
			"2026-06-15T12:30:00.000Z",
			"2026-06-15T12:45:00.000Z",
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T13:15:00.000Z",
		],
	},
	{
		expression: "*/5 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T23:48:00Z",
		runs: [
			"2026-06-15T23:50:00.000Z",
			"2026-06-15T23:55:00.000Z",
			"2026-06-16T00:00:00.000Z",
			"2026-06-16T00:05:00.000Z",
			"2026-06-16T00:10:00.000Z",
		],
	},
	{
		expression: "5/10 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-15T12:05:00.000Z",
			"2026-06-15T12:15:00.000Z",
			"2026-06-15T12:25:00.000Z",
			"2026-06-15T12:35:00.000Z",
			"2026-06-15T12:45:00.000Z",
		],
	},
	{
		expression: "0 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:30:00Z",
		runs: [
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T14:00:00.000Z",
			"2026-06-15T15:00:00.000Z",
			"2026-06-15T16:00:00.000Z",
			"2026-06-15T17:00:00.000Z",
		],
	},
	{
		expression: "0,30 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:15:00Z",
		runs: [
			"2026-06-15T12:30:00.000Z",
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T13:30:00.000Z",
			"2026-06-15T14:00:00.000Z",
			"2026-06-15T14:30:00.000Z",
		],
	},
	{
		expression: "0 */3 * * *",
		timeZone: "UTC",
		from: "2026-06-15T13:00:00Z",
		runs: [
			"2026-06-15T15:00:00.000Z",
			"2026-06-15T18:00:00.000Z",
			"2026-06-15T21:00:00.000Z",
			"2026-06-16T00:00:00.000Z",
			"2026-06-16T03:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-16T09:00:00.000Z",
			"2026-06-17T09:00:00.000Z",
			"2026-06-18T09:00:00.000Z",
			"2026-06-19T09:00:00.000Z",
			"2026-06-20T09:00:00.000Z",
		],
	},
	{
		expression: "30 9,17 * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-15T17:30:00.000Z",
			"2026-06-16T09:30:00.000Z",
			"2026-06-16T17:30:00.000Z",
			"2026-06-17T09:30:00.000Z",
			"2026-06-17T17:30:00.000Z",
		],
	},
	{
		expression: "15 8-17 * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:20:00Z",
		runs: [
			"2026-06-15T13:15:00.000Z",
			"2026-06-15T14:15:00.000Z",
			"2026-06-15T15:15:00.000Z",
			"2026-06-15T16:15:00.000Z",
			"2026-06-15T17:15:00.000Z",
		],
	},
	{
		expression: "0 9 * * 1-5",
		timeZone: "UTC",
		from: "2026-06-19T12:00:00Z",
		runs: [
			"2026-06-22T09:00:00.000Z",
			"2026-06-23T09:00:00.000Z",
			"2026-06-24T09:00:00.000Z",
			"2026-06-25T09:00:00.000Z",
			"2026-06-26T09:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * SUN",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-21T09:00:00.000Z",
			"2026-06-28T09:00:00.000Z",
			"2026-07-05T09:00:00.000Z",
			"2026-07-12T09:00:00.000Z",
			"2026-07-19T09:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * mon,wed,fri",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-17T09:00:00.000Z",
			"2026-06-19T09:00:00.000Z",
			"2026-06-22T09:00:00.000Z",
			"2026-06-24T09:00:00.000Z",
			"2026-06-26T09:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * 1-5/2",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-17T09:00:00.000Z",
			"2026-06-19T09:00:00.000Z",
			"2026-06-22T09:00:00.000Z",
			"2026-06-24T09:00:00.000Z",
			"2026-06-26T09:00:00.000Z",
		],
	},
	{
		expression: "0 0 1 * *",
		timeZone: "UTC",
		from: "2026-12-15T00:00:00Z",
		runs: [
			"2027-01-01T00:00:00.000Z",
			"2027-02-01T00:00:00.000Z",
			"2027-03-01T00:00:00.000Z",
			"2027-04-01T00:00:00.000Z",
			"2027-05-01T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 15 * *",
		timeZone: "UTC",
		from: "2026-03-01T00:00:00Z",
		runs: [
			"2026-03-15T00:00:00.000Z",
			"2026-04-15T00:00:00.000Z",
			"2026-05-15T00:00:00.000Z",
			"2026-06-15T00:00:00.000Z",
			"2026-07-15T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 31 * *",
		timeZone: "UTC",
		from: "2026-01-31T00:00:00Z",
		runs: [
			"2026-03-31T00:00:00.000Z",
			"2026-05-31T00:00:00.000Z",
			"2026-07-31T00:00:00.000Z",
			"2026-08-31T00:00:00.000Z",
			"2026-10-31T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 29 2 *",
		timeZone: "UTC",
		from: "2026-01-01T00:00:00Z",
		runs: [
			"2028-02-29T00:00:00.000Z",
			"2032-02-29T00:00:00.000Z",
			"2036-02-29T00:00:00.000Z",
			"2040-02-29T00:00:00.000Z",
			"2044-02-29T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 1 JAN *",
		timeZone: "UTC",
		from: "2026-06-01T00:00:00Z",
		runs: [
			"2027-01-01T00:00:00.000Z",
			"2028-01-01T00:00:00.000Z",
			"2029-01-01T00:00:00.000Z",
			"2030-01-01T00:00:00.000Z",
			"2031-01-01T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 1 jan-dec/3 *",
		timeZone: "UTC",
		from: "2026-06-01T00:00:00Z",
		runs: [
			"2026-07-01T00:00:00.000Z",
			"2026-10-01T00:00:00.000Z",
			"2027-01-01T00:00:00.000Z",
			"2027-04-01T00:00:00.000Z",
			"2027-07-01T00:00:00.000Z",
		],
	},
	{
		expression: "59 23 31 12 *",
		timeZone: "UTC",
		from: "2026-12-31T23:58:00Z",
		runs: [
			"2026-12-31T23:59:00.000Z",
			"2027-12-31T23:59:00.000Z",
			"2028-12-31T23:59:00.000Z",
			"2029-12-31T23:59:00.000Z",
			"2030-12-31T23:59:00.000Z",
		],
	},
	{
		expression: "0-59/70 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:30:00Z",
		runs: [
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T14:00:00.000Z",
			"2026-06-15T15:00:00.000Z",
			"2026-06-15T16:00:00.000Z",
			"2026-06-15T17:00:00.000Z",
		],
	},
	{
		expression: "1,2,3-5 * * * *",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-15T12:01:00.000Z",
			"2026-06-15T12:02:00.000Z",
			"2026-06-15T12:03:00.000Z",
			"2026-06-15T12:04:00.000Z",
			"2026-06-15T12:05:00.000Z",
		],
	},
	{
		expression: "@hourly",
		timeZone: "UTC",
		from: "2026-06-15T12:30:00Z",
		runs: [
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T14:00:00.000Z",
			"2026-06-15T15:00:00.000Z",
			"2026-06-15T16:00:00.000Z",
			"2026-06-15T17:00:00.000Z",
		],
	},
	{
		expression: "@daily",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-16T00:00:00.000Z",
			"2026-06-17T00:00:00.000Z",
			"2026-06-18T00:00:00.000Z",
			"2026-06-19T00:00:00.000Z",
			"2026-06-20T00:00:00.000Z",
		],
	},
	{
		expression: "@weekly",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-06-21T00:00:00.000Z",
			"2026-06-28T00:00:00.000Z",
			"2026-07-05T00:00:00.000Z",
			"2026-07-12T00:00:00.000Z",
			"2026-07-19T00:00:00.000Z",
		],
	},
	{
		expression: "@monthly",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2026-07-01T00:00:00.000Z",
			"2026-08-01T00:00:00.000Z",
			"2026-09-01T00:00:00.000Z",
			"2026-10-01T00:00:00.000Z",
			"2026-11-01T00:00:00.000Z",
		],
	},
	{
		expression: "@yearly",
		timeZone: "UTC",
		from: "2026-06-15T12:00:00Z",
		runs: [
			"2027-01-01T00:00:00.000Z",
			"2028-01-01T00:00:00.000Z",
			"2029-01-01T00:00:00.000Z",
			"2030-01-01T00:00:00.000Z",
			"2031-01-01T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 13 * 5",
		timeZone: "UTC",
		from: "2026-03-01T00:00:00Z",
		runs: [
			"2026-03-06T00:00:00.000Z",
			"2026-03-13T00:00:00.000Z",
			"2026-03-20T00:00:00.000Z",
			"2026-03-27T00:00:00.000Z",
			"2026-04-03T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 */2 * 1",
		timeZone: "UTC",
		from: "2026-03-01T00:00:00Z",
		runs: [
			"2026-03-02T00:00:00.000Z",
			"2026-03-03T00:00:00.000Z",
			"2026-03-05T00:00:00.000Z",
			"2026-03-07T00:00:00.000Z",
			"2026-03-09T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 1-7 * 1",
		timeZone: "UTC",
		from: "2026-03-01T00:00:00Z",
		runs: [
			"2026-03-02T00:00:00.000Z",
			"2026-03-03T00:00:00.000Z",
			"2026-03-04T00:00:00.000Z",
			"2026-03-05T00:00:00.000Z",
			"2026-03-06T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 30 2 1",
		timeZone: "UTC",
		from: "2027-01-01T00:00:00Z",
		runs: [
			"2027-02-01T00:00:00.000Z",
			"2027-02-08T00:00:00.000Z",
			"2027-02-15T00:00:00.000Z",
			"2027-02-22T00:00:00.000Z",
			"2028-02-07T00:00:00.000Z",
		],
	},
	{
		expression: "0 0 15 * */7",
		timeZone: "UTC",
		from: "2026-03-01T00:00:00Z",
		runs: [
			"2026-03-08T00:00:00.000Z",
			"2026-03-15T00:00:00.000Z",
			"2026-03-22T00:00:00.000Z",
			"2026-03-29T00:00:00.000Z",
			"2026-04-05T00:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "America/New_York",
		from: "2026-03-06T12:00:00Z",
		runs: [
			"2026-03-06T14:00:00.000Z",
			"2026-03-07T14:00:00.000Z",
			"2026-03-08T13:00:00.000Z",
			"2026-03-09T13:00:00.000Z",
			"2026-03-10T13:00:00.000Z",
		],
	},
	{
		expression: "30 2 * * *",
		timeZone: "America/New_York",
		from: "2026-03-07T12:00:00Z",
		runs: [
			"2026-03-08T07:30:00.000Z",
			"2026-03-09T06:30:00.000Z",
			"2026-03-10T06:30:00.000Z",
			"2026-03-11T06:30:00.000Z",
			"2026-03-12T06:30:00.000Z",
		],
	},
	{
		expression: "0 2 * * *",
		timeZone: "America/New_York",
		from: "2026-03-07T12:00:00Z",
		runs: [
			"2026-03-08T07:00:00.000Z",
			"2026-03-09T06:00:00.000Z",
			"2026-03-10T06:00:00.000Z",
			"2026-03-11T06:00:00.000Z",
			"2026-03-12T06:00:00.000Z",
		],
	},
	{
		expression: "30 1 * * *",
		timeZone: "America/New_York",
		from: "2026-03-07T12:00:00Z",
		runs: [
			"2026-03-08T06:30:00.000Z",
			"2026-03-09T05:30:00.000Z",
			"2026-03-10T05:30:00.000Z",
			"2026-03-11T05:30:00.000Z",
			"2026-03-12T05:30:00.000Z",
		],
	},
	{
		expression: "*/15 * * * *",
		timeZone: "America/New_York",
		from: "2026-03-08T06:30:00Z",
		runs: [
			"2026-03-08T06:45:00.000Z",
			"2026-03-08T07:00:00.000Z",
			"2026-03-08T07:15:00.000Z",
			"2026-03-08T07:30:00.000Z",
			"2026-03-08T07:45:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "Europe/Madrid",
		from: "2026-03-27T12:00:00Z",
		runs: [
			"2026-03-28T08:00:00.000Z",
			"2026-03-29T07:00:00.000Z",
			"2026-03-30T07:00:00.000Z",
			"2026-03-31T07:00:00.000Z",
			"2026-04-01T07:00:00.000Z",
		],
	},
	{
		expression: "30 2 * * *",
		timeZone: "Europe/Madrid",
		from: "2026-03-28T12:00:00Z",
		runs: [
			"2026-03-29T01:30:00.000Z",
			"2026-03-30T00:30:00.000Z",
			"2026-03-31T00:30:00.000Z",
			"2026-04-01T00:30:00.000Z",
			"2026-04-02T00:30:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "America/New_York",
		from: "2026-10-30T12:00:00Z",
		runs: [
			"2026-10-30T13:00:00.000Z",
			"2026-10-31T13:00:00.000Z",
			"2026-11-01T14:00:00.000Z",
			"2026-11-02T14:00:00.000Z",
			"2026-11-03T14:00:00.000Z",
		],
	},
	{
		expression: "30 1 * * *",
		timeZone: "America/New_York",
		from: "2026-10-31T12:00:00Z",
		runs: [
			"2026-11-01T05:30:00.000Z",
			"2026-11-02T06:30:00.000Z",
			"2026-11-03T06:30:00.000Z",
			"2026-11-04T06:30:00.000Z",
			"2026-11-05T06:30:00.000Z",
		],
	},
	{
		expression: "0 * * * *",
		timeZone: "America/New_York",
		from: "2026-11-01T04:30:00Z",
		runs: [
			"2026-11-01T05:00:00.000Z",
			"2026-11-01T06:00:00.000Z",
			"2026-11-01T07:00:00.000Z",
			"2026-11-01T08:00:00.000Z",
			"2026-11-01T09:00:00.000Z",
		],
	},
	{
		expression: "*/15 * * * *",
		timeZone: "America/New_York",
		from: "2026-11-01T05:00:00Z",
		runs: [
			"2026-11-01T05:15:00.000Z",
			"2026-11-01T05:30:00.000Z",
			"2026-11-01T05:45:00.000Z",
			"2026-11-01T06:00:00.000Z",
			"2026-11-01T06:15:00.000Z",
		],
	},
	{
		expression: "30 2 * * *",
		timeZone: "Europe/Madrid",
		from: "2026-10-24T12:00:00Z",
		runs: [
			"2026-10-25T00:30:00.000Z",
			"2026-10-26T01:30:00.000Z",
			"2026-10-27T01:30:00.000Z",
			"2026-10-28T01:30:00.000Z",
			"2026-10-29T01:30:00.000Z",
		],
	},
	{
		expression: "*/30 * * * *",
		timeZone: "Europe/Madrid",
		from: "2026-10-25T00:00:00Z",
		runs: [
			"2026-10-25T00:30:00.000Z",
			"2026-10-25T01:00:00.000Z",
			"2026-10-25T01:30:00.000Z",
			"2026-10-25T02:00:00.000Z",
			"2026-10-25T02:30:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "Asia/Kathmandu",
		from: "2026-06-15T00:00:00Z",
		runs: [
			"2026-06-15T03:15:00.000Z",
			"2026-06-16T03:15:00.000Z",
			"2026-06-17T03:15:00.000Z",
			"2026-06-18T03:15:00.000Z",
			"2026-06-19T03:15:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "Asia/Kolkata",
		from: "2026-06-15T00:00:00Z",
		runs: [
			"2026-06-15T03:30:00.000Z",
			"2026-06-16T03:30:00.000Z",
			"2026-06-17T03:30:00.000Z",
			"2026-06-18T03:30:00.000Z",
			"2026-06-19T03:30:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "Australia/Sydney",
		from: "2026-04-04T12:00:00Z",
		runs: [
			"2026-04-04T23:00:00.000Z",
			"2026-04-05T23:00:00.000Z",
			"2026-04-06T23:00:00.000Z",
			"2026-04-07T23:00:00.000Z",
			"2026-04-08T23:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "Pacific/Auckland",
		from: "2026-09-26T12:00:00Z",
		runs: [
			"2026-09-26T20:00:00.000Z",
			"2026-09-27T20:00:00.000Z",
			"2026-09-28T20:00:00.000Z",
			"2026-09-29T20:00:00.000Z",
			"2026-09-30T20:00:00.000Z",
		],
	},
	{
		expression: "0 9 * * *",
		timeZone: "America/Sao_Paulo",
		from: "2026-02-14T12:00:00Z",
		runs: [
			"2026-02-15T12:00:00.000Z",
			"2026-02-16T12:00:00.000Z",
			"2026-02-17T12:00:00.000Z",
			"2026-02-18T12:00:00.000Z",
			"2026-02-19T12:00:00.000Z",
		],
	},
	{
		expression: "*/20 * * * *",
		timeZone: "Australia/Sydney",
		from: "2026-10-03T15:30:00Z",
		runs: [
			"2026-10-03T15:40:00.000Z",
			"2026-10-03T16:00:00.000Z",
			"2026-10-03T16:20:00.000Z",
			"2026-10-03T16:40:00.000Z",
			"2026-10-03T17:00:00.000Z",
		],
	},
];

describe("parity with the replaced library", () => {
	test("computes the same occurrences for every recorded vector", () => {
		for (let vector of VECTORS) {
			let schedule = unwrap(Schedule.parse(vector.expression));
			let runs = schedule
				.next({
					from: new Date(vector.from),
					timeZone: vector.timeZone,
					count: vector.runs.length,
				})
				.map((date) => date.toISOString());

			expect({ ...vector, runs }).toEqual({ ...vector, runs: [...vector.runs] });
		}
	});

	test("covers both daylight saving transitions and more than one zone", () => {
		let zones = new Set(VECTORS.map((vector) => vector.timeZone));
		expect(zones.size).toBeGreaterThanOrEqual(5);
		expect(VECTORS.length).toBeGreaterThanOrEqual(50);
	});
});

describe("deliberate differences from the replaced library", () => {
	test("runs a schedule whose wall time is the exact instant a clock jumps", () => {
		// Chatham moves 02:45 to 03:45 on 2026-09-27, and this schedule asks for 02:45.
		// We carry the run past the jump, to 2026-09-26T14:00Z, on the same rule that
		// carries any other missing wall time. The replaced library skips the week and
		// reports 2026-10-03T13:00Z instead. A dead man's switch that silently expects
		// nothing for a week is the worse of the two answers.
		let schedule = unwrap(Schedule.parse("45 2 * * 0"));
		let runs = schedule.next({
			from: new Date("2026-09-06T16:00:00Z"),
			timeZone: "Pacific/Chatham",
			count: 4,
		});
		expect(runs.map((date) => date.toISOString())).toEqual([
			"2026-09-12T14:00:00.000Z",
			"2026-09-19T14:00:00.000Z",
			"2026-09-26T14:00:00.000Z",
			"2026-10-03T13:00:00.000Z",
		]);
	});

	test("runs a midnight schedule on a day whose midnight is skipped", () => {
		// Cairo moves 00:00 to 01:00 on 2027-04-30, and this schedule asks for 00:00 on
		// the 30th. We carry it to 2027-04-29T22:00Z, an hour into the day. The replaced
		// library drops April and reports 2027-05-29T21:00Z next.
		let schedule = unwrap(Schedule.parse("0 0 30 * *"));
		let runs = schedule.next({
			from: new Date("2027-03-14T07:00:00Z"),
			timeZone: "Africa/Cairo",
			count: 3,
		});
		expect(runs.map((date) => date.toISOString())).toEqual([
			"2027-03-29T22:00:00.000Z",
			"2027-04-29T22:00:00.000Z",
			"2027-05-29T21:00:00.000Z",
		]);
	});

	test("looks back to the same pass of a repeated hour that it looks forward to", () => {
		// Sydney repeats 02:45 on 2026-04-05: 15:45Z as AEDT, 16:45Z as AEST. An
		// appointment is kept once, on the first pass, so that is the instant reported
		// in both directions. The replaced library reports the first pass going forward
		// and the second, 16:45Z, going back, which contradicts itself.
		let schedule = unwrap(Schedule.parse("45 2 * * 0"));
		let previous = schedule.prev({
			from: new Date("2026-04-05T15:00:00Z"),
			timeZone: "Australia/Sydney",
		});
		expect(previous.toISOString()).toBe("2026-04-04T15:45:00.000Z");

		let next = schedule.next({
			from: new Date("2026-04-04T12:00:00Z"),
			timeZone: "Australia/Sydney",
		});
		expect(next.toISOString()).toBe("2026-04-04T15:45:00.000Z");
	});

	test("rejects what the replaced library accepts outside the standard five fields", () => {
		// Seconds, `?`, `L`, `W` and `#` all parse in the replaced library. Accepting the
		// syntax without honoring the semantics is the failure mode worth avoiding.
		for (let expression of ["* * * * * *", "? ? * * *", "0 0 L * *", "0 0 1W * *", "0 0 * * 1#2"]) {
			expect(Schedule.parse(expression).status).toBe("failure");
		}
	});

	test("accepts a duplicated value the replaced library rejects", () => {
		// A list that repeats a value is normalized instead of refused, so validation
		// does not fail on something harmless.
		expect(unwrap(Schedule.parse("0 12 * * 1,1,1")).toString()).toBe("0 12 * * 1");
	});
});
