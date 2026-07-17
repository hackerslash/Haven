import { getDb } from "./client";
import { base64ToBytes, bytesToBase64 } from "../../lib/base64";

export type FileRecord = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  data: Uint8Array;
};

export async function insertFile(file: FileRecord): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO files (id, name, size, mime_type, data) VALUES (?1, ?2, ?3, ?4, ?5)",
    [file.id, file.name, file.size, file.mimeType, bytesToBase64(file.data)]
  );
}

export async function getFile(id: string): Promise<FileRecord | null> {
  const db = await getDb();
  const rows = await db.select<any[]>("SELECT * FROM files WHERE id = ?1", [id]);
  if (rows.length === 0) return null;
  const row = rows[0];
  
  let parsedData: Uint8Array;
  if (typeof row.data === "string") {
    if (row.data.startsWith("[")) {
      // Legacy JSON array format
      parsedData = new Uint8Array(JSON.parse(row.data));
    } else {
      // Base64 format
      parsedData = base64ToBytes(row.data);
    }
  } else {
    // Array format directly from tauri-plugin-sql
    parsedData = new Uint8Array(row.data);
  }

  return {
    id: row.id,
    name: row.name,
    size: row.size,
    mimeType: row.mime_type,
    data: parsedData,
  };
}
