import { loadEnvFile } from "node:process";
import { getDb } from "../src/db";
import { seedDemo } from "../src/db/seed";

try { loadEnvFile(".env"); } catch {}
const { profileId } = seedDemo(getDb());
console.log(`Seeded demo family. care_profile_id=${profileId}`);
