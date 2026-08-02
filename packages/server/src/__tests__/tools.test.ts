import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileTool } from '../tools/read-file';
import { writeFileTool } from '../tools/write-file';
import { editTool } from '../tools/edit';
import { listDirTool } from '../tools/list-dir';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('tool: write_file', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feynman-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a file with the given content', async () => {
    const filePath = path.join(tmpDir, 'hello.txt');
    const result = await writeFileTool.execute({ path: filePath, content: 'hello world' });
    expect(result).toContain('hello.txt');
    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('hello world');
  });

  it('creates parent directories automatically', async () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c.txt');
    await writeFileTool.execute({ path: filePath, content: 'nested' });
    const written = await fs.readFile(filePath, 'utf-8');
    expect(written).toBe('nested');
  });
});

describe('tool: read_file', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feynman-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns file content with line numbers', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await fs.writeFile(filePath, 'line one\nline two\nline three');
    const result = await readFileTool.execute({ path: filePath });
    expect(result).toContain('1: line one');
    expect(result).toContain('2: line two');
    expect(result).toContain('3: line three');
  });
});

describe('tool: edit', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feynman-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('replaces a unique occurrence', async () => {
    const filePath = path.join(tmpDir, 'test.ts');
    await fs.writeFile(filePath, 'function hello() {\n  return "hello";\n}');
    await editTool.execute({ path: filePath, old_str: '"hello"', new_str: '"world"' });
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('"world"');
    expect(content).not.toContain('"hello"');
  });

  it('fails when old_str is not found', async () => {
    const filePath = path.join(tmpDir, 'test.ts');
    await fs.writeFile(filePath, 'hello world');
    await expect(
      editTool.execute({ path: filePath, old_str: 'not there', new_str: 'x' }),
    ).rejects.toThrow('not found');
  });

  it('fails when old_str is not unique', async () => {
    const filePath = path.join(tmpDir, 'test.ts');
    await fs.writeFile(filePath, 'foo\nfoo\nfoo');
    await expect(
      editTool.execute({ path: filePath, old_str: 'foo', new_str: 'bar' }),
    ).rejects.toThrow('3 times');
  });
});

describe('tool: list_dir', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feynman-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists files and directories', async () => {
    await fs.writeFile(path.join(tmpDir, 'index.ts'), '');
    await fs.mkdir(path.join(tmpDir, 'src'));
    await fs.writeFile(path.join(tmpDir, 'src', 'main.ts'), '');

    const result = await listDirTool.execute({ path: tmpDir, depth: 2 });
    expect(result).toContain('src/');
    expect(result).toContain('index.ts');
    expect(result).toContain('main.ts');
  });

  it('skips node_modules', async () => {
    await fs.mkdir(path.join(tmpDir, 'node_modules'));
    await fs.writeFile(path.join(tmpDir, 'src.ts'), '');

    const result = await listDirTool.execute({ path: tmpDir });
    expect(result).not.toContain('node_modules');
    expect(result).toContain('src.ts');
  });
});
