export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = Math.round(minutes / 60);
    return `${h} hour${h > 1 ? "s" : ""}`;
  }
  const d = Math.round(minutes / 1440);
  return `${d} day${d > 1 ? "s" : ""}`;
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatPrice(price) {
  return `KES ${Number(price).toLocaleString()}`;
}
