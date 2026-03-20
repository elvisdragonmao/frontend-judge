import fs from "node:fs";
import path from "node:path";

const CLEANUP_MARKER_FILE = ".last-cleanup-tw";
const TAIWAN_UTC_OFFSET_HOURS = 8;

function formatLocalDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getCleanupWindowKey(now: Date, cleanupHourTw: number): string {
  const shifted = new Date(
    now.getTime() + TAIWAN_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );

  if (shifted.getUTCHours() < cleanupHourTw) {
    shifted.setUTCDate(shifted.getUTCDate() - 1);
  }

  return formatLocalDateKey(shifted);
}

export function prepareSharedPnpmStore(
  storeDir: string,
  cleanupHourTw: number,
): { cleaned: boolean; cleanupKey: string } {
  fs.mkdirSync(storeDir, { recursive: true });

  const cleanupKey = getCleanupWindowKey(new Date(), cleanupHourTw);
  const markerPath = path.join(storeDir, CLEANUP_MARKER_FILE);
  const previousCleanupKey = fs.existsSync(markerPath)
    ? fs.readFileSync(markerPath, "utf-8").trim()
    : "";

  if (previousCleanupKey === cleanupKey) {
    return { cleaned: false, cleanupKey };
  }

  for (const entry of fs.readdirSync(storeDir)) {
    fs.rmSync(path.join(storeDir, entry), { recursive: true, force: true });
  }

  fs.writeFileSync(markerPath, cleanupKey, "utf-8");
  return { cleaned: true, cleanupKey };
}
