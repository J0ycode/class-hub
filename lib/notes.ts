import type { Catalogue, Note, Subject } from "./types";

export type NotesModule = { id: string; name: string; notes: Note[]; pyq: boolean };
export type NotesSubject = {
  id: string;
  name: string;
  code: string;
  modules: NotesModule[];
  noteCount: number;
  hasPyq: boolean;
};

const PYQ_SUFFIX = / - PYQ$/i;

function moduleLabel(name: string): string {
  // "MODULE 1" / "MODULE 1 - THEORY OF COMPUTATION" -> "Module 1"
  const m = name.match(/^MODULE\s*(\d+)/i);
  return m ? `Module ${m[1]}` : name;
}

function notesFor(cat: Catalogue, subject: Subject, pyq: boolean): NotesModule[] {
  return subject.modules
    .map((m) => ({
      id: m.id,
      name: pyq ? m.name : moduleLabel(m.name),
      pyq,
      notes: cat.notes
        .filter((n) => n.subjectId === subject.id && n.moduleId === m.id)
        .sort((a, b) => a.order - b.order),
    }))
    .filter((m) => m.notes.length > 0);
}

/**
 * Notes grouped subject -> module. "Previous year question" subjects (named
 * "<parent full name> - PYQ") are folded into their parent subject.
 */
export function notesLibrary(cat: Catalogue): NotesSubject[] {
  const pyqSubjects = cat.subjects.filter((s) => PYQ_SUFFIX.test(s.name));
  const mainSubjects = cat.subjects.filter((s) => !PYQ_SUFFIX.test(s.name));
  const folded = new Set<string>();

  const library = mainSubjects.map((s) => {
    const modules = notesFor(cat, s, false);
    for (const p of pyqSubjects) {
      if (p.name.replace(PYQ_SUFFIX, "").trim() === s.fullName.trim()) {
        modules.push(...notesFor(cat, p, true));
        folded.add(p.id);
      }
    }
    return { subject: s, modules };
  });

  // A PYQ set with no matching parent still gets its own entry.
  for (const p of pyqSubjects) {
    if (!folded.has(p.id)) library.push({ subject: p, modules: notesFor(cat, p, true) });
  }

  return library
    .filter((x) => x.modules.length > 0)
    .map(({ subject, modules }) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      modules,
      noteCount: modules.reduce((n, m) => n + m.notes.length, 0),
      hasPyq: modules.some((m) => m.pyq),
    }));
}
