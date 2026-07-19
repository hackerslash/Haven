import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:colloquium.db";

// The keyed (SQLCipher) pool is built and injected Rust-side in `db::init`
// during app setup, keyed by DB_URL. Database.get() returns a JS handle over
// that already-open pool WITHOUT invoking `plugin:sql|load` — so the encryption
// key never transits the webview. NEVER use Database.load() here: it would
// build a second, unkeyed pool and overwrite the injected one in DbInstances.
const dbPromise: Promise<Database> = Promise.resolve(Database.get(DB_URL));

export function getDb(): Promise<Database> {
  return dbPromise;
}
