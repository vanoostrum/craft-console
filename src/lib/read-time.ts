const AMSTERDAM = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Read at HH:MM", in Europe/Amsterdam time, 24-hour. */
export function readAtLabel(time: number): string {
  return `Read at ${AMSTERDAM.format(time)}`;
}
