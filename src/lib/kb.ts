import type { KbEntry, KbVersion } from "./types";

// Fictional hotel. All content is synthetic.
const base = (): KbEntry[] => [
  {
    id: "checkin",
    keywords: ["check in", "checkin", "early arrival", "arrive early"],
    answer:
      "Check-in starts at 3:00 PM. Early check-in is based on availability, and the front desk can note your request.",
  },
  {
    id: "checkout",
    keywords: ["checkout", "check out", "late checkout", "late check out"],
    answer: "Checkout is at 11:00 AM. Late checkout until 1:00 PM is $25, based on availability.",
  },
  {
    id: "parking",
    keywords: ["parking", "park", "garage"],
    answer: "Self-parking is $32 per night with in and out privileges. Oversized vehicles do not fit the garage.",
  },
  {
    id: "breakfast",
    keywords: ["breakfast"],
    answer: "Complimentary breakfast is served 6:30 to 9:30 AM on weekdays and 7:00 to 10:00 AM on weekends.",
  },
  {
    id: "pool",
    keywords: ["pool", "swim"],
    answer: "The pool is open 7:00 AM to 10:00 PM. Children under 14 need an adult.",
  },
  {
    id: "pets",
    keywords: ["pet", "dog", "cat"],
    answer: "Dogs under 40 lbs are welcome for a $75 one-time fee. Other pets are not allowed.",
  },
  {
    id: "wifi",
    keywords: ["wifi", "wi fi", "internet"],
    answer: "Wi-Fi is free. Connect to CedarGuest and sign in with your room number and last name.",
  },
  {
    id: "shuttle",
    keywords: ["shuttle", "airport"],
    answer: "The free airport shuttle runs every 30 minutes from 5:00 AM to 11:00 PM.",
  },
  {
    id: "cancel",
    keywords: ["cancel", "cancellation"],
    answer: "Reservations can be cancelled free of charge up to 48 hours before arrival.",
  },
  {
    id: "gym",
    keywords: ["gym", "fitness", "workout"],
    answer: "The fitness room is open 24 hours with your room key.",
  },
];

/** What the agent knows today: prices and hours are stale after the Nov 1 policy change. */
export const live: KbVersion = {
  id: "live",
  label: "Live KB (as published)",
  entries: base(),
  changelog: [],
};

/**
 * A manager's draft edit. Intent: update late-checkout fee, parking rate and
 * shuttle hours, and add EV charging. Side effects are realistic and unplanned:
 * the manager also trims "late checkout" aliases from the checkout entry, and the new
 * "late arrival" entry (listed ahead of checkout) now outscores it on "late check out";
 * the EV entry has the broad keyword "charger", which also matches a lost phone charger.
 */
const draftEntries = (): KbEntry[] => {
  const e = base();
  const by = (id: string) => e.find((x) => x.id === id)!;
  by("checkout").answer = "Checkout is at 11:00 AM. Late checkout until 1:00 PM is $40, based on availability.";
  // "Tidy-up": the manager removes what looks like duplicate aliases.
  by("checkout").keywords = ["checkout", "check out"];
  by("parking").answer = "Self-parking is $38 per night with in and out privileges. Oversized vehicles do not fit the garage.";
  by("shuttle").answer = "The free airport shuttle runs every 30 minutes from 5:00 AM to midnight.";
  const lateArrival: KbEntry = {
    id: "late-arrival",
    keywords: ["late", "late check", "after hours"],
    answer: "The front desk is staffed 24 hours. If you arrive after midnight, use the side entrance and call the desk.",
  };
  const ev: KbEntry = {
    id: "ev-charging",
    keywords: ["ev", "ev charging", "electric vehicle", "charger", "charging", "tesla"],
    answer: "Two Level 2 EV chargers are in the garage at $0.30 per kWh, first come first served.",
  };
  const idx = e.findIndex((x) => x.id === "checkout");
  return [...e.slice(0, idx), lateArrival, ...e.slice(idx), ev];
};

export const draft: KbVersion = {
  id: "draft",
  label: "Draft KB (pending approval)",
  entries: draftEntries(),
  changelog: [
    "Late checkout fee $25 -> $40",
    "Parking $32 -> $38 per night",
    "Shuttle ends at midnight instead of 11:00 PM",
    "Removed duplicate-looking aliases from checkout",
    "Added: late arrival (after-hours entry)",
    "Added: EV charging",
  ],
};

export const kbVersions = { live, draft } as const;
