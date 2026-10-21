// All Takkar days are India Standard Time days (FRS: "All times are IST").
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole IST days since 1 Jan 1970. Changing the phone's time zone changes nothing (TC-21). */
export function istDay(now = Date.now()) {
  return Math.floor((now + IST_OFFSET_MS) / DAY_MS);
}

/** Monday of the IST week containing `day` (1 Jan 1970 was a Thursday). */
export function weekStart(day = istDay()) {
  return day - ((day + 3) % 7);
}

export function msUntilNextIstDay(now = Date.now()) {
  return DAY_MS - ((now + IST_OFFSET_MS) % DAY_MS);
}

export function dayLabel(day) {
  const d = new Date(day * DAY_MS);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
