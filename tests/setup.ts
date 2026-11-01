import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fake services write their state to a throwaway directory per test file, never into data/fakes/state.
process.env.FAKES_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "careagent-state-"));
delete process.env.OPENAI_API_KEY;
