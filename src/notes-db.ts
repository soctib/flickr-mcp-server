import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", "notes.db");

let db: Database.Database;

export type EntityType = "photo" | "album" | "group";

export interface NoteRow {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export function initNotesDb(): void {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('photo', 'album', 'group')),
      entity_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);
  `);
}

export function addNote(
  entityType: EntityType,
  entityId: string,
  note: string
): NoteRow {
  const stmt = db.prepare(`
    INSERT INTO notes (entity_type, entity_id, note)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(entityType, entityId, note);

  return db
    .prepare("SELECT * FROM notes WHERE id = ?")
    .get(result.lastInsertRowid) as NoteRow;
}

export function getNotes(entityType: EntityType, entityId: string): NoteRow[] {
  return db
    .prepare(
      "SELECT * FROM notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC"
    )
    .all(entityType, entityId) as NoteRow[];
}

export function deleteNote(noteId: number): boolean {
  const result = db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
  return result.changes > 0;
}

export function searchNotes(query: string): NoteRow[] {
  return db
    .prepare(
      "SELECT * FROM notes WHERE note LIKE ? ORDER BY updated_at DESC LIMIT 50"
    )
    .all(`%${query}%`) as NoteRow[];
}
