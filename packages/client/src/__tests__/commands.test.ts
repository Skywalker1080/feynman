import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  matchCommands,
  currentSlashToken,
  SLASH_COMMANDS,
} from '../ui/commands';

describe('parseCommand', () => {
  it('parses a plain command', () => {
    expect(parseCommand('/new')).toEqual({ name: 'new' });
  });

  it('parses a command with an argument', () => {
    expect(parseCommand('/resume abc123')).toEqual({ name: 'resume', arg: 'abc123' });
  });

  it('resolves aliases', () => {
    expect(parseCommand('/quit')).toEqual({ name: 'exit' });
  });

  it('returns null for non-commands', () => {
    expect(parseCommand('hello world')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });

  it('returns null for unknown commands', () => {
    expect(parseCommand('/bogus')).toBeNull();
  });
});

describe('matchCommands', () => {
  it('returns all commands for an empty token', () => {
    expect(matchCommands('/')).toEqual(SLASH_COMMANDS);
  });

  it('filters by prefix', () => {
    const names = matchCommands('/re').map((c) => c.name);
    expect(names).toContain('resume');
    expect(names).not.toContain('new');
  });

  it('matches aliases by prefix', () => {
    const names = matchCommands('qu').map((c) => c.name);
    expect(names).toContain('exit');
  });
});

describe('currentSlashToken', () => {
  it('returns the leading slash token', () => {
    expect(currentSlashToken('/res')).toBe('/res');
    expect(currentSlashToken('/resume abc')).toBe('/resume');
  });

  it('returns null when buffer is not a slash command', () => {
    expect(currentSlashToken('plain text')).toBeNull();
    expect(currentSlashToken('')).toBeNull();
    expect(currentSlashToken('  /resume')).toBeNull();
  });
});
