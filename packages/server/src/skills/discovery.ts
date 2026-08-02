import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Skill } from '@feynman/types';

/**
 * Discovers skills from a directory of <name>/SKILL.md files at startup.
 * Parses YAML frontmatter for name + description.
 * Full content is only loaded on demand (keeps the system prompt lean).
 */
export class SkillsDiscovery {
  private skills: Skill[] = [];

  constructor(
    /** Raw skills dir path from config (may be relative) */
    private readonly skillsDir: string,
    /** Working directory to resolve relative paths against */
    private readonly cwd: string,
  ) {}

  /** Scan the skills directory and populate the manifest. Call once at startup. */
  discover(): void {
    const resolvedDir = path.isAbsolute(this.skillsDir)
      ? this.skillsDir
      : path.join(this.cwd, this.skillsDir);

    if (!fs.existsSync(resolvedDir)) {
      this.skills = [];
      return;
    }

    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const discovered: Skill[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(resolvedDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const raw = fs.readFileSync(skillMdPath, 'utf-8');
        const { data } = matter(raw);

        if (typeof data['name'] === 'string' && typeof data['description'] === 'string') {
          discovered.push({
            name: data['name'],
            description: data['description'],
            path: skillMdPath,
          });
        }
      } catch {
        // Skip malformed skill files silently — don't crash the server
      }
    }

    this.skills = discovered;
  }

  /** Returns name + description manifest (not full content) for system prompt injection */
  getManifest(): Skill[] {
    return this.skills;
  }

  /**
   * Returns the full markdown body of a skill (stripping frontmatter).
   * Returns null if the skill is not found.
   */
  getSkillContent(name: string): string | null {
    const skill = this.skills.find((s) => s.name === name);
    if (!skill) return null;

    try {
      const raw = fs.readFileSync(skill.path, 'utf-8');
      const { content } = matter(raw);
      return content.trim();
    } catch {
      return null;
    }
  }
}
