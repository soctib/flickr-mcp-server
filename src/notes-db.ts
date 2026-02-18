import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, "..", "notes.json");

export type EntityType = "photo" | "album" | "group";

export interface NoteRow {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  note: string;
  created_at: string;
}

interface NotesData {
  next_id: number;
  notes: NoteRow[];
}

let data: NotesData;

function save(): void {
  writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
}

export function initNotesDb(): void {
  if (existsSync(JSON_PATH)) {
    data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
  } else {
    data = { next_id: 1, notes: [] };
    save();
  }
}

export function addNote(
  entityType: EntityType,
  entityId: string,
  note: string
): NoteRow {
  const row: NoteRow = {
    id: data.next_id++,
    entity_type: entityType,
    entity_id: entityId,
    note,
    created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  data.notes.push(row);
  save();
  return row;
}

export function getNotes(entityType: EntityType, entityId: string): NoteRow[] {
  return data.notes
    .filter((n) => n.entity_type === entityType && n.entity_id === entityId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function deleteNote(noteId: number): boolean {
  const idx = data.notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return false;
  data.notes.splice(idx, 1);
  save();
  return true;
}

export function searchNotes(query: string): NoteRow[] {
  const lower = query.toLowerCase();
  return data.notes
    .filter((n) => n.note.toLowerCase().includes(lower))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 50);
}
