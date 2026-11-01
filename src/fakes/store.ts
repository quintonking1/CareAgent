import fs from "node:fs";
import path from "node:path";

// Fake external services keep their data in JSON files:
//   data/fakes/*.json        hand-editable seed data (committed), e.g. the Zocdoc directory
//   data/fakes/state/**.json what the services have "recorded" (bookings, calendar, outbox); reset with the demo

export const seedDir = () => path.join(process.cwd(), "data", "fakes");
export const stateDir = () => process.env.FAKES_STATE_DIR || path.join(seedDir(), "state");
export const statePath = (name: string) => path.join(stateDir(), name);

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

// Write-then-rename so a reader never sees a half-written file.
export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

export function resetState() {
  fs.rmSync(stateDir(), { recursive: true, force: true });
}
