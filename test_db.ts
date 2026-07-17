import { getDb } from "./src/services/db/client";
import { insertFile, getFile } from "./src/services/db/fileRepo";

async function main() {
  const db = await getDb();
  // We cannot use tauri plugin sql outside tauri!
}
