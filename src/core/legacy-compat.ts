import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STATE_DIR_NAME,
  LEGACY_STATE_DIR_NAMES,
  ENV_PREFIX,
  LEGACY_ENV_PREFIXES,
} from './constants.js';

export function hydrateLegacyEnv(): void {
  for (const legacy of LEGACY_ENV_PREFIXES) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (!key.startsWith(legacy)) continue;
      const mapped = ENV_PREFIX + key.slice(legacy.length);
      if (process.env[mapped] === undefined) process.env[mapped] = value;
    }
  }
}

export function migrateLegacyStateDir(): void {
  try {
    const home = os.homedir();
    const next = path.join(home, STATE_DIR_NAME);
    // Gate on the config file, not on the directory. Anything that runs before this — dev.sh
    // does `mkdir -p ~/<state>/dev` — leaves an empty shell behind, and an existsSync() check
    // on the directory then reads that shell as "already migrated" and silently abandons the
    // user's real config in the legacy dir.
    if (fs.existsSync(path.join(next, 'setting.json'))) return;

    for (const legacy of LEGACY_STATE_DIR_NAMES) {
      const prev = path.join(home, legacy);
      if (!fs.existsSync(path.join(prev, 'setting.json'))) continue;
      if (!fs.existsSync(next)) {
        try {
          fs.renameSync(prev, next);
          return;
        } catch { /* fall through to the copy path */ }
      }
      // Target already exists (that empty shell): merge rather than replace, so whatever
      // created it keeps working, and leave the legacy dir in place for the older build that
      // may still be reading it.
      fs.cpSync(prev, next, { recursive: true, force: false, errorOnExist: false });
      return;
    }
  } catch {
  }
}
