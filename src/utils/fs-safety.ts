import fs from 'fs';
import path from 'path';

// Resolves to the real (symlink-free) canonical form. If the path doesn't fully exist yet (a
// scan root that hasn't been created, an agent-supplied cwd one level below a real directory),
// canonicalizes the deepest EXISTING ancestor and reattaches the remaining segments as-is —
// falling back to a fully lexical path.resolve() would silently stop canonicalizing partway
// through and no longer compare consistently against a sibling path that did fully resolve (e.g.
// macOS aliases /tmp -> /private/tmp: a resolved existing project path becomes
// /private/var/folders/..., but a lexical resolve of a non-existent child under the same parent
// would stay /var/folders/..., breaking prefix comparisons between the two).
export function realOrResolved(p: string): string {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync(abs);
  } catch {
    const parent = path.dirname(abs);
    if (parent === abs) return abs; // reached the filesystem root — nothing left to canonicalize
    return path.join(realOrResolved(parent), path.basename(abs));
  }
}

// True if `candidate` is `root` itself or a real descendant of it.
export function isWithinRealPath(root: string, candidate: string): boolean {
  const realRoot = realOrResolved(root);
  const realCandidate = realOrResolved(candidate);
  return realCandidate === realRoot || realCandidate.startsWith(realRoot + path.sep);
}

// True if both paths resolve to the literal same file on disk (same device+inode) — catches both
// symlinks and hardlinks pointing at the same file, which a realpath-string-equality check alone
// would miss for hardlinks (no distinct realpath) and get right for symlinks anyway, but this is
// the more direct check when the question is specifically "is this the same file" rather than
// "is this contained within that directory".
export function isSameFile(pathA: string, pathB: string): boolean {
  try {
    const a = fs.statSync(pathA);
    const b = fs.statSync(pathB);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}
