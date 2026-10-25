/**
 * The examples of RFC 8984 §6 as JSON text, with the `"..."` placeholders replaced by the
 * `@type`, `uid` and `updated` a complete object needs, and errata 8028 applied to the
 * group (`title`, not `name`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** §6.1 Simple Event. */
export const SIMPLE_EVENT = `{
  "@type": "Event",
  "uid": "a8df6573-0474-496d-8496-033ad45d7fea",
  "updated": "2020-01-02T18:23:04Z",
  "title": "Some event",
  "start": "2020-01-15T13:00:00",
  "timeZone": "America/New_York",
  "duration": "PT1H"
}`;

/** §6.2 Simple Task. */
export const SIMPLE_TASK = `{
  "@type": "Task",
  "uid": "2a358cee-6489-4f14-a57f-c104db4dc2f2",
  "updated": "2020-01-09T14:32:01Z",
  "title": "Do something"
}`;

/** §6.3 Simple Group, as errata 8028 corrects it. */
export const SIMPLE_GROUP = `{
  "@type": "Group",
  "uid": "bf0ac22b-4989-4caf-9ebd-54301b4ee51a",
  "updated": "2020-01-15T18:00:00Z",
  "title": "A simple group",
  "entries": [{
    "@type": "Event",
    "uid": "a8df6573-0474-496d-8496-033ad45d7fea",
    "updated": "2020-01-02T18:23:04Z",
    "title": "Some event",
    "start": "2020-01-15T13:00:00",
    "timeZone": "America/New_York",
    "duration": "PT1H"
  },
  {
    "@type": "Task",
    "uid": "2a358cee-6489-4f14-a57f-c104db4dc2f2",
    "updated": "2020-01-09T14:32:01Z",
    "title": "Do something"
  }]
}`;

/** §6.4 All-Day Event. */
export const ALL_DAY_EVENT = `{
  "@type": "Event",
  "uid": "april-fools@example.com",
  "updated": "2020-01-01T00:00:00Z",
  "title": "April Fool's Day",
  "showWithoutTime": true,
  "start": "1900-04-01T00:00:00",
  "duration": "P1D",
  "recurrenceRules": [{
    "@type": "RecurrenceRule",
    "frequency": "yearly"
  }]
}`;

/** §6.5 Task with a Due Date. */
export const TASK_WITH_DUE_DATE = `{
  "@type": "Task",
  "uid": "groceries@example.com",
  "updated": "2020-01-18T09:00:00Z",
  "title": "Buy groceries",
  "due": "2020-01-19T18:00:00",
  "timeZone": "Europe/Vienna",
  "estimatedDuration": "PT1H"
}`;

/** §6.6 Event with End Time Zone. */
export const END_TIME_ZONE_EVENT = `{
  "@type": "Event",
  "uid": "xy51@example.com",
  "updated": "2020-03-01T10:00:00Z",
  "title": "Flight XY51 to Tokyo",
  "start": "2020-04-01T09:00:00",
  "timeZone": "Europe/Berlin",
  "duration": "PT10H30M",
  "locations": {
    "1": {
      "@type": "Location",
      "rel": "start",
      "name": "Frankfurt Airport (FRA)"
    },
    "2": {
      "@type": "Location",
      "rel": "end",
      "name": "Narita International Airport (NRT)",
      "timeZone": "Asia/Tokyo"
    }
  }
}`;

/** §6.7 Floating-Time Event (with Recurrence). */
export const FLOATING_EVENT = `{
  "@type": "Event",
  "uid": "yoga@example.com",
  "updated": "2019-12-31T12:00:00Z",
  "title": "Yoga",
  "start": "2020-01-01T07:00:00",
  "duration": "PT30M",
  "recurrenceRules": [{
    "@type": "RecurrenceRule",
    "frequency": "daily"
  }]
}`;

/** §6.8 Event with Multiple Locations and Localization. */
export const LOCALIZED_EVENT = `{
  "@type": "Event",
  "uid": "music-bowl@example.com",
  "updated": "2020-06-01T00:00:00Z",
  "title": "Live from Music Bowl: The Band",
  "description": "Go see the biggest music event ever!",
  "locale": "en",
  "start": "2020-07-04T17:00:00",
  "timeZone": "America/New_York",
  "duration": "PT3H",
  "locations": {
    "c0503d30-8c50-4372-87b5-7657e8e0fedd": {
      "@type": "Location",
      "name": "The Music Bowl",
      "description": "Music Bowl, Central Park, New York",
      "coordinates": "geo:40.7829,-73.9654"
    }
  },
  "virtualLocations": {
    "vloc1": {
      "@type": "VirtualLocation",
      "name": "Free live Stream from Music Bowl",
      "uri": "https://stream.example.com/the_band_2020"
    }
  },
  "localizations": {
    "de": {
      "title": "Live von der Music Bowl: The Band!",
      "description": "Schau dir das größte Musikereignis an!",
      "virtualLocations/vloc1/name": "Gratis Live-Stream aus der Music Bowl"
    }
  }
}`;

/** §6.9 Recurring Event with Overrides. */
export const OVERRIDES_EVENT = `{
  "@type": "Event",
  "uid": "calculus-1@example.com",
  "updated": "2019-12-01T00:00:00Z",
  "title": "Calculus I",
  "start": "2020-01-08T09:00:00",
  "timeZone": "Europe/London",
  "duration": "PT1H30M",
  "locations": {
    "mlab": {
      "@type": "Location",
      "title": "Math lab room 1",
      "description": "Math Lab I, Department of Mathematics"
    }
  },
  "recurrenceRules": [{
    "@type": "RecurrenceRule",
    "frequency": "weekly",
    "until": "2020-06-24T09:00:00"
  }],
  "recurrenceOverrides": {
    "2020-01-07T14:00:00": {
      "title": "Introduction to Calculus I (optional)"
    },
    "2020-04-01T09:00:00": {
      "excluded": true
    },
    "2020-06-25T09:00:00": {
      "title": "Calculus I Exam",
      "start": "2020-06-25T10:00:00",
      "duration": "PT2H",
      "locations": {
        "auditorium": {
          "@type": "Location",
          "title": "Big Auditorium",
          "description": "Big Auditorium, Other Road"
        }
      }
    }
  }
}`;

/** §6.10 Recurring Event with Participants. */
export const PARTICIPANTS_EVENT = `{
  "@type": "Event",
  "uid": "foobar-team@example.com",
  "updated": "2020-01-01T00:00:00Z",
  "title": "FooBar team meeting",
  "start": "2020-01-08T09:00:00",
  "timeZone": "Africa/Johannesburg",
  "duration": "PT1H",
  "virtualLocations": {
    "0": {
      "@type": "VirtualLocation",
      "name": "ChatMe meeting room",
      "uri": "https://chatme.example.com?id=1234567&pw=a8a24627b63d"
    }
  },
  "recurrenceRules": [{
    "@type": "RecurrenceRule",
    "frequency": "weekly"
  }],
  "replyTo": {
    "imip": "mailto:f245f875-7f63-4a5e-a2c8@schedule.example.com"
  },
  "participants": {
    "dG9tQGZvb2Jhci5xlLmNvbQ": {
      "@type": "Participant",
      "name": "Tom Tool",
      "email": "tom@foobar.example.com",
      "sendTo": {
        "imip": "mailto:tom@calendar.example.com"
      },
      "participationStatus": "accepted",
      "roles": {
        "attendee": true
      }
    },
    "em9lQGZvb2GFtcGxlLmNvbQ": {
      "@type": "Participant",
      "name": "Zoe Zelda",
      "email": "zoe@foobar.example.com",
      "sendTo": {
        "imip": "mailto:zoe@foobar.example.com"
      },
      "participationStatus": "accepted",
      "roles": {
        "owner": true,
        "attendee": true,
        "chair": true
      }
    }
  },
  "recurrenceOverrides": {
    "2020-03-04T09:00:00": {
      "participants/dG9tQGZvb2Jhci5xlLmNvbQ/participationStatus": "declined"
    }
  }
}`;

/** Every example, by section, for the tests that run over all of them. */
export const EXAMPLES = {
	"6.1": SIMPLE_EVENT,
	"6.2": SIMPLE_TASK,
	"6.3": SIMPLE_GROUP,
	"6.4": ALL_DAY_EVENT,
	"6.5": TASK_WITH_DUE_DATE,
	"6.6": END_TIME_ZONE_EVENT,
	"6.7": FLOATING_EVENT,
	"6.8": LOCALIZED_EVENT,
	"6.9": OVERRIDES_EVENT,
	"6.10": PARTICIPANTS_EVENT,
};
