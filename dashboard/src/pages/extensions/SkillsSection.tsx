import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import type { SkillCatalogItem, SkillInfo, RemoteSkillInfo } from '../../types';
import { cn } from '../../utils';
import { Button, Input, Modal, ModalHeader, Spinner, SectionLabel } from '../../components/ui';
import { L, useCachedResource, ExternalLinkIcon, CheckCircleIcon, UpdateIcon, StarIcon, BrandAvatar, formatStarCount, formatRelativeTime, EmptyState } from './shared';

// Skills: catalog section, cards, detail modal and the custom-skill dialog.
// Split out of ExtensionsTab.tsx; contents moved verbatim.

const CATEGORY_META: Record<string, { zh: string; en: string; order: number }> = {
  dev:           { zh: '开发工具',     en: 'Development',     order: 0 },
  productivity:  { zh: '生产力',       en: 'Productivity',    order: 1 },
  communication: { zh: '协作沟通',     en: 'Communication',   order: 2 },
  data:          { zh: '数据',         en: 'Data',            order: 3 },
  search:        { zh: '搜索',         en: 'Search',          order: 4 },
  utility:       { zh: '工具',         en: 'Utility',         order: 5 },
  custom:        { zh: '自定义',       en: 'Custom',          order: 6 },
};

function CustomSkillDialog({
  open, onClose, locale, scope, workdir, onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  scope: 'global' | 'workspace';
  workdir?: string;
  onInstalled: () => void;
}) {
  const toast = useStore(s => s.toast);
  const [source, setSource] = useState('');
  const [skillName, setSkillName] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => { if (open) { setSource(''); setSkillName(''); } }, [open]);

  const submit = async () => {
    if (!source.trim()) return;
    setInstalling(true);
    try {
      const r = await api.installSkill(source.trim(), scope === 'global', skillName.trim() || undefined, workdir);
      if (r.ok) {
        toast(L(locale, '技能安装成功', 'Skill installed'), true);
        onInstalled();
        onClose();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) {
      toast(e?.message || 'Failed', false);
    } finally { setInstalling(false); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={L(locale, '安装自定义技能', 'Install Custom Skill')}
        description={L(locale, '通过 npx skills add 从 GitHub 仓库安装。', 'Installs via npx skills add from a GitHub repo.')}
        onClose={onClose}
      />
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, 'GitHub 来源', 'GitHub Source')}</label>
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder="owner/repo" className="font-mono" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, '指定技能（可选）', 'Specific skill (optional)')}</label>
          <Input value={skillName} onChange={e => setSkillName(e.target.value)} placeholder={L(locale, '留空安装全部', 'Leave empty for all')} />
        </div>
        <div className="flex justify-end gap-2 border-t border-edge pt-3">
          <Button variant="ghost" onClick={onClose}>{L(locale, '取消', 'Cancel')}</Button>
          <Button variant="primary" disabled={!source.trim() || installing} onClick={submit}>
            {installing ? <Spinner /> : L(locale, '安装', 'Install')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


function skillCountSummary(item: SkillCatalogItem, locale: string): string {
  const installed = item.installedNames.length;
  if (typeof item.totalCount === 'number') {
    const totalStr = item.partial ? `${item.totalCount}+` : String(item.totalCount);
    return locale === 'zh-CN'
      ? `${installed} / ${totalStr} 已安装`
      : `${installed} / ${totalStr} installed`;
  }
  return installed > 0
    ? (locale === 'zh-CN' ? `${installed} 已安装` : `${installed} installed`)
    : L(locale, '未安装', 'Not installed');
}

function SkillConnectedCard({
  item, locale, animationDelay, onClick, onUpdate, updating,
}: {
  item: SkillCatalogItem;
  locale: string;
  animationDelay?: string;
  onClick: () => void;
  onUpdate?: () => void;
  updating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-in-up group relative flex min-h-[112px] w-full flex-col overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4 text-left transition-[background,border-color] duration-200 hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--brand-glow-a)]"
      style={{ animationDelay }}
    >
      <div className="relative flex items-start gap-3">
        <BrandAvatar iconUrl={item.iconUrl} name={item.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[13px] font-semibold text-fg">{item.name}</span>
              {item.homepage && (
                <a href={item.homepage} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-fg-5 transition-colors hover:text-primary">
                  <ExternalLinkIcon />
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.updateAvailable && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-warn)]"
                      style={{ background: 'color-mix(in oklab, var(--th-warn) 14%, transparent)' }}>
                  <UpdateIcon size={10} />{L(locale, '可更新', 'Update')}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-ok)]"
                    style={{ background: 'color-mix(in oklab, var(--th-ok) 12%, transparent)' }}>
                <CheckCircleIcon size={10} />{skillCountSummary(item, locale)}
              </span>
            </div>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-5">{item.source}</div>
          <div className="mt-1 line-clamp-2 text-[11.5px] text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
      </div>
      <div className="relative mt-auto pt-3 flex items-center justify-between text-[10.5px] text-fg-5">
        <span className="flex items-center gap-2">
          {item.stars !== undefined && (
            <span className="inline-flex items-center gap-0.5 font-medium text-fg-4">
              <StarIcon size={10} />{formatStarCount(item.stars)}
            </span>
          )}
          {item.pushedAt && <span>{formatRelativeTime(item.pushedAt, locale)}</span>}
        </span>
        <span className="flex items-center gap-2.5">
          {item.updateAvailable && onUpdate && (
            <span
              role="button"
              tabIndex={0}
              aria-label={L(locale, '更新到最新', 'Update to latest')}
              onClick={(e) => { e.stopPropagation(); if (!updating) onUpdate(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); e.stopPropagation(); if (!updating) onUpdate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold text-[var(--th-warn)] transition hover:brightness-110"
              style={{ background: 'color-mix(in oklab, var(--th-warn) 14%, transparent)' }}
            >
              {updating ? <Spinner className="h-3 w-3" /> : <><UpdateIcon size={11} />{L(locale, '更新', 'Update')}</>}
            </span>
          )}
          <span className="text-fg-5 group-hover:text-primary transition-colors">
            {L(locale, '管理 →', 'Manage →')}
          </span>
        </span>
      </div>
    </button>
  );
}

function SkillAvailableCard({
  item, locale, animationDelay, onClick,
}: {
  item: SkillCatalogItem;
  locale: string;
  animationDelay?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-in-up group relative flex min-h-[112px] w-full flex-col overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4 text-left transition-[background,border-color] duration-200 hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--brand-glow-a)]"
      style={{ animationDelay }}
    >
      <div className="flex items-start gap-3">
        <BrandAvatar iconUrl={item.iconUrl} name={item.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-fg">{item.name}</span>
            {item.homepage && (
              <a href={item.homepage} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-fg-5 transition-colors hover:text-primary">
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11.5px] text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
      </div>
      <div className="mt-auto pt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] text-fg-5">
          {item.stars !== undefined && (
            <span className="inline-flex items-center gap-0.5 font-medium text-fg-4">
              <StarIcon size={10} />{formatStarCount(item.stars)}
            </span>
          )}
          {typeof item.totalCount === 'number' && (
            <span>· {item.partial ? `${item.totalCount}+` : item.totalCount} skills</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--edge-subtle)] bg-transparent px-2.5 py-1 text-[11px] font-semibold text-fg-3 transition-colors group-hover:border-[var(--edge-default)] group-hover:text-fg">
          {L(locale, '查看 →', 'Browse →')}
        </span>
      </div>
    </button>
  );
}

function LocalSkillCard({
  skill, locale, animationDelay, busy, onRemove,
}: {
  skill: SkillInfo;
  locale: string;
  animationDelay?: string;
  busy: boolean;
  onRemove: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <div
      className="animate-in-up group relative flex min-h-[112px] w-full flex-col overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4 text-left transition-[background,border-color] duration-200 hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)]"
      style={{ animationDelay }}
      onMouseLeave={() => setArmed(false)}
    >
      <div className="relative flex items-start gap-3">
        <BrandAvatar name={skill.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-fg">{skill.label || skill.name}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-fg-4 shrink-0"
              style={{ background: 'color-mix(in oklab, var(--fg-5) 14%, transparent)' }}
            >
              {L(locale, '本地', 'Local')}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11.5px] text-fg-5">/{skill.name}</div>
          {skill.description && (
            <div className="mt-1 line-clamp-2 text-[11.5px] text-fg-4">{skill.description}</div>
          )}
        </div>
      </div>
      <div className="relative mt-auto pt-3 flex items-center justify-between text-[10.5px] text-fg-5">
        <span>
          {skill.scope === 'global'
            ? L(locale, '全局 · ~/.urdr/skills', 'Global · ~/.urdr/skills')
            : L(locale, '项目 · .urdr/skills', 'Project · .urdr/skills')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => { if (armed) { setArmed(false); onRemove(); } else setArmed(true); }}
          className={armed ? '!text-err' : 'hover:!text-err'}
        >
          {busy ? <Spinner /> : armed ? L(locale, '确认移除？', 'Confirm remove?') : L(locale, '移除', 'Remove')}
        </Button>
      </div>
    </div>
  );
}

function SkillDetailModal({
  item, open, onClose, onChanged, locale, scope, workdir, installedSkills,
}: {
  item: SkillCatalogItem | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  locale: string;
  scope: 'global' | 'workspace';
  workdir?: string;
  installedSkills: SkillInfo[];
}) {
  const toast = useStore(s => s.toast);
  const [remoteSkills, setRemoteSkills] = useState<RemoteSkillInfo[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remotePartial, setRemotePartial] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'install' | 'remove' | 'update' | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError(null);
    setQuery('');
    void (async () => {
      try {
        const r = await api.listRepoSkills(item.source);
        if (cancelled) return;
        if (r.ok) {
          setRemoteSkills(r.skills);
          setRemotePartial(!!r.partial);
        } else {
          setRemoteError(r.error || 'failed to list');
          setRemoteSkills([]);
        }
      } catch (e: any) {
        if (cancelled) return;
        setRemoteError(e?.message || 'failed');
        setRemoteSkills([]);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, item?.source]);

  const installedNamesLower = useMemo(() => {
    const set = new Set<string>();
    const targetScope = scope === 'global' ? 'global' : 'project';
    for (const s of installedSkills) {
      if (s.scope === targetScope) set.add(s.name.toLowerCase());
    }
    return set;
  }, [installedSkills, scope]);

  const filtered = useMemo(() => {
    const list = remoteSkills || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => s.name.toLowerCase().includes(q));
  }, [remoteSkills, query]);

  const installedCount = useMemo(() => {
    if (!remoteSkills) return 0;
    return remoteSkills.filter(s => installedNamesLower.has(s.name.toLowerCase())).length;
  }, [remoteSkills, installedNamesLower]);

  const handleInstallOne = useCallback(async (name: string) => {
    if (!item) return;
    setBusyName(name);
    try {
      const r = await api.installSkill(item.source, scope === 'global', name, workdir);
      if (r.ok) {
        toast(L(locale, `${name} 已安装`, `${name} installed`), true);
        onChanged();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBusyName(null); }
  }, [item, scope, workdir, locale, toast, onChanged]);

  const handleRemoveOne = useCallback(async (name: string) => {
    setBusyName(name);
    try {
      const r = await api.removeExtensionSkill(name, scope === 'global', workdir);
      if (r.ok) {
        toast(L(locale, `${name} 已移除`, `${name} removed`), true);
        onChanged();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBusyName(null); }
  }, [scope, workdir, locale, toast, onChanged]);

  const handleInstallAll = useCallback(async () => {
    if (!item) return;
    setBulkBusy('install');
    try {
      const r = await api.installSkill(item.source, scope === 'global', undefined, workdir);
      if (r.ok) {
        toast(L(locale, '全部安装完成', 'All skills installed'), true);
        onChanged();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBulkBusy(null); }
  }, [item, scope, workdir, locale, toast, onChanged]);

  const handleUpdateAll = useCallback(async () => {
    if (!item) return;
    setBulkBusy('update');
    try {
      const r = await api.updateSkill(item.source, scope === 'global', workdir);
      if (r.ok) {
        toast(L(locale, '已更新到最新版本', 'Updated to the latest version'), true);
        onChanged();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBulkBusy(null); }
  }, [item, scope, workdir, locale, toast, onChanged]);

  const handleRemoveAll = useCallback(async () => {
    if (!item || !remoteSkills) return;
    setBulkBusy('remove');
    try {
      const targets = remoteSkills
        .map(s => s.name)
        .filter(name => installedNamesLower.has(name.toLowerCase()));
      for (const name of targets) {
        await api.removeExtensionSkill(name, scope === 'global', workdir);
      }
      toast(L(locale, '已移除该集合下的全部技能', 'Removed all skills from this collection'), true);
      onChanged();
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBulkBusy(null); }
  }, [item, remoteSkills, installedNamesLower, scope, workdir, locale, toast, onChanged]);

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalHeader
        title={item.name}
        description={locale === 'zh-CN' ? item.descriptionZh : item.description}
        onClose={onClose}
      />
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BrandAvatar iconUrl={item.iconUrl} name={item.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              {item.name}
              {item.homepage && (
                <a href={item.homepage} target="_blank" rel="noreferrer" className="text-fg-5 hover:text-primary">
                  <ExternalLinkIcon />
                </a>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-4">
              <span className="truncate text-fg-5">{item.source}</span>
              {item.stars !== undefined && (
                <span className="inline-flex items-center gap-0.5 text-fg-5">
                  <StarIcon size={10} />{formatStarCount(item.stars)}
                </span>
              )}
              {item.pushedAt && <span className="text-fg-5">· {formatRelativeTime(item.pushedAt, locale)}</span>}
            </div>
          </div>
        </div>

        {item.updateAvailable && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] text-fg-2"
            style={{
              background: 'color-mix(in oklab, var(--th-warn) 12%, transparent)',
              border: '1px solid color-mix(in oklab, var(--th-warn) 30%, transparent)',
            }}
          >
            <span className="mt-0.5 text-[var(--th-warn)]"><UpdateIcon size={13} /></span>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--th-warn)]">{L(locale, '检测到新版本', 'A newer version is available')}</div>
              <div className="mt-0.5 text-fg-4">
                {L(locale,
                  '远端仓库有更新，点击「更新到最新」拉取最新内容。',
                  'The remote repo has moved ahead. Click "Update to latest" to pull the newest content.')}
                {item.installedSha && item.latestSha && (
                  <span className="ml-1 font-mono text-[11px] text-fg-5">
                    {item.installedSha.slice(0, 7)} → {item.latestSha.slice(0, 7)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] font-semibold text-fg-3">
              {L(locale, '该集合下的技能', 'Skills in this collection')}
              {remoteSkills && (
                <span className="ml-2 text-[11px] font-normal text-fg-5">
                  {installedCount} / {remotePartial ? `${remoteSkills.length}+` : remoteSkills.length}
                  {' '}{L(locale, '已安装', 'installed')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.installed && (
                <Button
                  variant={item.updateAvailable ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handleUpdateAll}
                  disabled={bulkBusy !== null}
                >
                  {bulkBusy === 'update'
                    ? <Spinner />
                    : (
                      <span className="inline-flex items-center gap-1">
                        <UpdateIcon size={12} />
                        {item.updateAvailable
                          ? L(locale, '更新到最新', 'Update to latest')
                          : L(locale, '重新拉取', 'Re-pull latest')}
                      </span>
                    )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleInstallAll}
                disabled={bulkBusy !== null || remoteLoading}
              >
                {bulkBusy === 'install' ? <Spinner /> : L(locale, '全部安装', 'Install all')}
              </Button>
              {installedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAll}
                  disabled={bulkBusy !== null}
                  className="hover:!text-err"
                >
                  {bulkBusy === 'remove' ? <Spinner /> : L(locale, '全部移除', 'Remove all')}
                </Button>
              )}
            </div>
          </div>

          {(remoteSkills && remoteSkills.length > 6) && (
            <Input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={L(locale, '搜索技能…', 'Search skills…')}
              className="w-full"
            />
          )}

          {remoteLoading ? (
            <div className="flex items-center justify-center py-10"><Spinner /></div>
          ) : remoteError ? (
            <div className="rounded-lg border border-edge/70 bg-panel/60 p-3 text-[12px] text-fg-4">
              {L(locale,
                '无法从 GitHub 拉取技能列表（可能是网络或速率限制）。你仍可以使用上方的「全部安装」按钮一次性安装该集合。',
                'Could not list skills from GitHub (network or rate-limit). You can still use "Install all" to grab the whole collection.')}
              <div className="mt-1 truncate font-mono text-[11px] text-fg-5">{remoteError}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-edge/70 bg-panel/60 p-3 text-center text-[12px] text-fg-5">
              {query
                ? L(locale, '没有匹配的技能', 'No matching skills')
                : L(locale, '该集合暂无可识别的技能', 'No discoverable skills in this collection')}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-edge/70 bg-panel/40">
              {filtered.map((skill, i) => {
                const isInstalled = installedNamesLower.has(skill.name.toLowerCase());
                const busy = busyName === skill.name;
                return (
                  <div
                    key={skill.name}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2 text-[12px]',
                      i > 0 && 'border-t border-edge/40',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isInstalled && (
                          <CheckCircleIcon size={12} />
                        )}
                        <span className={cn('truncate font-medium', isInstalled ? 'text-[var(--th-ok)]' : 'text-fg-2')}>
                          {skill.name}
                        </span>
                      </div>
                      {skill.description && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-fg-5">{skill.description}</div>
                      )}
                    </div>
                    {isInstalled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemoveOne(skill.name)}
                        disabled={busy || bulkBusy !== null}
                        className="hover:!text-err"
                      >
                        {busy ? <Spinner /> : L(locale, '移除', 'Remove')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleInstallOne(skill.name)}
                        disabled={busy || bulkBusy !== null}
                      >
                        {busy ? <Spinner /> : L(locale, '安装', 'Install')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {remotePartial && (
            <div className="text-[11px] text-fg-5">
              {L(locale,
                '仓库内技能数量较多，仅显示前 1000 个。可使用上方搜索或直接打开仓库浏览全部。',
                'Showing the first 1000 skills. Use search or open the repo on GitHub for the full list.')}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}


export function SkillsCatalogSection({
  scope, workdir, locale,
}: {
  scope: 'global' | 'workspace';
  workdir?: string;
  locale: string;
}) {
  const cacheKey = `pikiloom.skills.catalog.${scope}.${workdir || ''}`;
  const { data, loading, refresh } = useCachedResource<{ items: SkillCatalogItem[]; installed: SkillInfo[] }>(
    cacheKey,
    async () => {
      const r = await api.getSkillsCatalog(workdir, scope);
      return { items: r.items || [], installed: r.installed || [] };
    },
    [workdir, scope],
  );

  const [customOpen, setCustomOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removingLocal, setRemovingLocal] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);
  const toast = useStore(s => s.toast);

  const items = data?.items || [];
  const installedAll = data?.installed || [];
  const installedSkills = useMemo(() => {
    const targetScope = scope === 'global' ? 'global' : 'project';
    return installedAll.filter(s => s.scope === targetScope);
  }, [installedAll, scope]);

  const connected = useMemo(() => items.filter(i => i.installedNames.length > 0), [items]);
  const available = useMemo(() => items.filter(i => i.installedNames.length === 0), [items]);

  const localSkills = useMemo(() => {
    const claimed = new Set<string>();
    for (const it of items) for (const n of it.installedNames) claimed.add(n.toLowerCase());
    return installedSkills.filter(s => !claimed.has(s.name.toLowerCase()));
  }, [items, installedSkills]);

  const handleRemoveLocal = useCallback(async (name: string) => {
    setRemovingLocal(name);
    try {
      const r = await api.removeExtensionSkill(name, scope === 'global', workdir);
      if (r.ok) {
        toast(L(locale, `${name} 已移除`, `${name} removed`), true);
        void refresh();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setRemovingLocal(null); }
  }, [scope, workdir, locale, toast, refresh]);

  const handleUpdate = useCallback(async (item: SkillCatalogItem) => {
    setUpdatingSource(item.source);
    try {
      const r = await api.updateSkill(item.source, scope === 'global', workdir);
      if (r.ok) {
        toast(L(locale, `${item.name} 已更新到最新`, `${item.name} updated to latest`), true);
        void refresh();
      } else toast(r.error || 'Failed', false);
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setUpdatingSource(null); }
  }, [scope, workdir, locale, toast, refresh]);
  const groupedAvailable = useMemo(() => {
    const map = new Map<string, SkillCatalogItem[]>();
    for (const it of available) {
      const k = it.category;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return [...map.entries()].sort(([a], [b]) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99));
  }, [available]);

  const selected = selectedId ? items.find(i => i.id === selectedId) || null : null;
  const showSpinner = loading && !data;
  const totalInstalled = installedSkills.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <SectionLabel>Skills</SectionLabel>
          {!loading && (
            <span className="text-[11px] text-fg-5">
              {totalInstalled} {L(locale, '已安装', 'installed')} · {available.length} {L(locale, '可用', 'available')}
            </span>
          )}
          {loading && <Spinner className="h-3 w-3" />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            {loading ? L(locale, '刷新中…', 'Refreshing…') : L(locale, '刷新', 'Refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCustomOpen(true)}>
            + {L(locale, '从 GitHub 安装', 'Install from GitHub')}
          </Button>
        </div>
      </div>

      {showSpinner ? (
        <div className="flex items-center justify-center py-10"><Spinner /></div>
      ) : items.length === 0 && localSkills.length === 0 ? (
        <EmptyState
          title={L(locale, '暂无可用的技能包', 'No skill packs available')}
          subtitle={L(locale, '从 GitHub 导入一个开始使用', 'Import from GitHub to get started')}
        />
      ) : (
        <>
          {(connected.length > 0 || localSkills.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-3">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--th-ok)]"></span>
                {L(locale, '已安装', 'Installed')}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {connected.map((c, i) => (
                  <SkillConnectedCard
                    key={c.id}
                    item={c}
                    locale={locale}
                    animationDelay={`${Math.min(i, 12) * 30}ms`}
                    onClick={() => setSelectedId(c.id)}
                    onUpdate={() => void handleUpdate(c)}
                    updating={updatingSource === c.source}
                  />
                ))}
                {localSkills.map((s, i) => (
                  <LocalSkillCard
                    key={`local-${s.name}`}
                    skill={s}
                    locale={locale}
                    animationDelay={`${Math.min(connected.length + i, 12) * 30}ms`}
                    busy={removingLocal === s.name}
                    onRemove={() => void handleRemoveLocal(s.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {available.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-3">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-5/50"></span>
                {L(locale, '推荐', 'Available')}
              </div>
              {groupedAvailable.map(([cat, list]) => (
                <div key={cat} className="space-y-2">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-5">
                    {locale === 'zh-CN' ? (CATEGORY_META[cat]?.zh || cat) : (CATEGORY_META[cat]?.en || cat)}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((item, i) => (
                      <SkillAvailableCard
                        key={item.id}
                        item={item}
                        locale={locale}
                        animationDelay={`${Math.min(i, 12) * 30}ms`}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SkillDetailModal
        item={selected}
        open={!!selected}
        onClose={() => setSelectedId(null)}
        onChanged={() => { void refresh(); }}
        locale={locale}
        scope={scope}
        workdir={workdir}
        installedSkills={installedAll}
      />

      <CustomSkillDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        locale={locale}
        scope={scope}
        workdir={workdir}
        onInstalled={refresh}
      />
    </section>
  );
}

