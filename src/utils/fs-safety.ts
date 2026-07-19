import fs from 'fs';
import path from 'path';

// Resolves to the real (symlink-free) canonical form when possible; falls back to the lexical
// path.resolve() result when the path doesn't exist yet (nothing to canonicalize) or a component
// isn't accessible. Every boundary/containment check in this codebase must compare REAL paths —
// a lexical path.resolve() comparison can be bypassed by a symlink whose lexical path looks
// contained but whose target isn't.
export function realOrResolved(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
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
