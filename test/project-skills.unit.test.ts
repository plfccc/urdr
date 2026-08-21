import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Bot } from '../src/bot/bot.ts';
import { collapseSkillPrompt, getProjectSkillPaths, initializeProjectSkills } from '../src/agent/index.ts';
import { resolveSkillPrompt } from '../src/bot/commands.ts';
import { captureEnv, makeTmpDir, restoreEnv } from './support/env.ts';

const envSnapshot = captureEnv(['URDR_CONFIG', 'URDR_WORKDIR']);

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeSkill(root: string, name: string, body: string) {
  writeFile(path.join(root, name, 'SKILL.md'), body);
}

beforeEach(() => {
  restoreEnv(envSnapshot);
  process.env.URDR_CONFIG = path.join(makeTmpDir('urdr-config-'), 'setting.json');
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe('project skills', () => {
  it('resolves skill paths, routes per-agent, merges legacy roots, and collapses shorthand', () => {
    {
      const workdir = makeTmpDir('urdr-claude-skill-');
      writeSkill(path.join(workdir, '.urdr', 'skills'), 'install', '---\nlabel: Install\ndescription: shared\n---\n');
      writeSkill(path.join(workdir, '.claude', 'skills'), 'install', '---\nlabel: Install\ndescription: claude\n---\n');

      const bot = new Bot();
      bot.switchWorkdir(workdir, { persist: false });
      bot.chat(1).agent = 'claude';

      expect(getProjectSkillPaths(workdir, 'install')).toEqual({
        sharedSkillFile: path.join(workdir, '.urdr', 'skills', 'install', 'SKILL.md'),
        claudeSkillFile: path.join(workdir, '.claude', 'skills', 'install', 'SKILL.md'),
        agentsSkillFile: path.join(workdir, '.agents', 'skills', 'install', 'SKILL.md'),
      });

      const resolved = resolveSkillPrompt(bot, 1, 'sk_install', 'ship it');
      expect(resolved).not.toBeNull();
      expect(resolved!.skillName).toBe('install');
      expect(resolved!.prompt).toContain(workdir);
      expect(resolved!.prompt).toContain('.claude/skills/install/SKILL.md');
      expect(resolved!.prompt).toContain('Additional context: ship it');
    }

    {
      const workdir = makeTmpDir('urdr-codex-skill-');
      writeSkill(path.join(workdir, '.urdr', 'skills'), 'fixup', '---\nlabel: Fixup\ndescription: shared\n---\n');
      writeSkill(path.join(workdir, '.agents', 'skills'), 'fixup', '---\nlabel: Fixup\ndescription: agents\n---\n');

      const bot = new Bot();
      bot.switchWorkdir(workdir, { persist: false });
      bot.chat(2).agent = 'codex';

      const resolved = resolveSkillPrompt(bot, 2, 'sk_fixup', '');
      expect(resolved).not.toBeNull();
      expect(resolved!.skillName).toBe('fixup');
      expect(resolved!.prompt).toContain(workdir);
      expect(resolved!.prompt).toContain('.claude/skills/fixup/SKILL.md');
    }

    {
      const workdir = makeTmpDir('urdr-migrate-skill-');
      writeSkill(path.join(workdir, '.urdr', 'skills'), 'ship', '---\nlabel: Ship\ndescription: shared\n---\n');
      writeFile(path.join(workdir, '.urdr', 'skills', 'ship', 'references', 'shared.txt'), 'shared\n');
      writeSkill(path.join(workdir, '.claude', 'skills'), 'ship', '---\nlabel: Ship\ndescription: claude\n---\n');
      writeFile(path.join(workdir, '.claude', 'skills', 'ship', 'references', 'claude.txt'), 'preserved\n');
      writeSkill(path.join(workdir, '.agents', 'skills'), 'package', '---\nlabel: Package\ndescription: agents\n---\n');

      initializeProjectSkills(workdir);

      expect(fs.lstatSync(path.join(workdir, '.urdr', 'skills')).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(path.join(workdir, '.urdr', 'skills', 'ship', 'SKILL.md'), 'utf8')).toContain('description: shared');
      expect(fs.existsSync(path.join(workdir, '.urdr', 'skills', 'ship', 'references', 'shared.txt'))).toBe(true);
      expect(fs.existsSync(path.join(workdir, '.urdr', 'skills', 'ship', 'references', 'claude.txt'))).toBe(true);
      expect(fs.existsSync(path.join(workdir, '.urdr', 'skills', 'package', 'SKILL.md'))).toBe(true);
      expect(fs.lstatSync(path.join(workdir, '.claude', 'skills')).isSymbolicLink()).toBe(true);
      expect(fs.lstatSync(path.join(workdir, '.agents', 'skills')).isSymbolicLink()).toBe(true);
      expect(fs.realpathSync(path.join(workdir, '.claude', 'skills'))).toBe(fs.realpathSync(path.join(workdir, '.urdr', 'skills')));
      expect(fs.realpathSync(path.join(workdir, '.agents', 'skills'))).toBe(fs.realpathSync(path.join(workdir, '.urdr', 'skills')));
    }

    {
      const workdir = makeTmpDir('urdr-relink-skill-');
      const claudeSkills = path.join(workdir, '.claude', 'skills');
      fs.mkdirSync(path.dirname(claudeSkills), { recursive: true });
      fs.symlinkSync('../.pikiclaw/skills', claudeSkills, process.platform === 'win32' ? 'junction' : 'dir');
      expect(fs.existsSync(claudeSkills)).toBe(false);

      initializeProjectSkills(workdir);

      // A win32 junction can only store an absolute target, so assert on where the link
      // resolves to; only POSIX keeps the relative form the writer passed in.
      const expectRelinked = () => {
        expect(fs.realpathSync(claudeSkills)).toBe(fs.realpathSync(path.join(workdir, '.urdr', 'skills')));
        if (process.platform !== 'win32') {
          expect(fs.lstatSync(claudeSkills).isSymbolicLink()).toBe(true);
          expect(fs.readlinkSync(claudeSkills)).toBe(path.join('..', '.urdr', 'skills'));
        }
      };
      expectRelinked();

      initializeProjectSkills(workdir);
      expectRelinked();
    }

    {
      const workdir = makeTmpDir('urdr-collapse-skill-');
      writeSkill(path.join(workdir, '.urdr', 'skills'), 'install', '---\nlabel: Install\n---\n');
      const bot = new Bot();
      bot.switchWorkdir(workdir, { persist: false });
      bot.chat(7).agent = 'claude';

      const noArgs = resolveSkillPrompt(bot, 7, 'sk_install', '');
      expect(noArgs).not.toBeNull();
      expect(collapseSkillPrompt(noArgs!.prompt)).toBe('/install');

      const withArgs = resolveSkillPrompt(bot, 7, 'sk_install', 'ship it now');
      expect(withArgs).not.toBeNull();
      expect(collapseSkillPrompt(withArgs!.prompt)).toBe('/install ship it now');

      const flattened = noArgs!.prompt.replace(/\s+/g, ' ').trim();
      expect(collapseSkillPrompt(flattened)).toBe('/install');

      expect(collapseSkillPrompt('hello world')).toBeNull();
      expect(collapseSkillPrompt('')).toBeNull();
      expect(collapseSkillPrompt(null)).toBeNull();
      expect(collapseSkillPrompt('[Project directory: /tmp]\n\nbuild the app')).toBeNull();
    }
  });
});
