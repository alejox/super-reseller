import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where a supplier panel session lives on disk.
 *
 * ONE FILE PER PANEL LOGIN, holding cookies and localStorage — Playwright's
 * `storageState`. This is the whole reason the automation never touches the
 * login form: the panel asks for a verification code to get in, a human types
 * it once, and everything after that reuses what that login produced.
 *
 * WHAT IS IN THIS FILE. Not a password — this project never stores one — but a
 * live session, which for as long as it lasts is worth exactly as much. It
 * belongs outside the repository and outside any backup that leaves the
 * machine. `.gitignore` covers the default location; if you move it, move that
 * line too.
 */

const DEFAULT_DIR = path.join(process.cwd(), ".sessions");

/** Filesystem-safe name for a panel url, so two suppliers cannot collide. */
export function sessionSlug(panelUrl: string): string {
  return panelUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function sessionPath(panelUrl: string, dir: string = DEFAULT_DIR): string {
  return path.join(dir, `${sessionSlug(panelUrl)}.json`);
}

export async function ensureSessionDir(dir: string = DEFAULT_DIR): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Reads a saved session, or `null` when there is none.
 *
 * `null` is not an error: it is the ordinary state before anybody has logged
 * in, and the caller's job is to say so plainly rather than to crash.
 */
export async function readSession(
  panelUrl: string,
  dir: string = DEFAULT_DIR,
): Promise<string | null> {
  try {
    return await readFile(sessionPath(panelUrl, dir), "utf8");
  } catch {
    return null;
  }
}
