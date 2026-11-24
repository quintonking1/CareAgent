import { loadEnvFile } from "node:process";
import { getDb } from "../src/db";
import { seedHomeDemo } from "../src/db/seed";

try { loadEnvFile(".env"); } catch {}
const { profileId } = seedHomeDemo(getDb());
console.log(`Seeded demo family. care_profile_id=${profileId}`);
