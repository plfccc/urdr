import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import type { McpCatalogItem, McpServerConfig } from '../../types';
import { cn } from '../../utils';
import { Button, Input, Modal, ModalHeader, Spinner, SectionLabel } from '../../components/ui';
import { L, authKindLabel, useCachedResource, ExternalLinkIcon, BrandAvatar, StatePill, openOAuthPopup, groupByCategory, CategoryGroup, EmptyState } from './shared';

// MCP servers: catalog section, cards and dialogs.
// Split out of ExtensionsTab.tsx; contents moved verbatim.

function CredentialsDialog({
  open, onClose, locale, item, initial, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  item: McpCatalogItem | null;
  initial?: Record<string, string>;
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && item && item.auth.type === 'credentials') {
      const seed: Record<string, string> = {};
      for (const f of item.auth.fields) seed[f.key] = initial?.[f.key] || '';
      setValues(seed);
    }
  }, [open, item, initial]);

  if (!item || item.auth.type !== 'credentials') return null;
  const missingRequired = item.auth.fields.some(f => f.required && !(values[f.key] || '').trim());

  const submit = async () => {
    setSubmitting(true);
    try { await onSubmit(values); } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={L(locale, `配置 ${item.name}`, `Configure ${item.name}`)}
        description={locale === 'zh-CN' ? item.descriptionZh : item.description}
        onClose={onClose}
      />
      <div className="space-y-3">
        {item.auth.fields.map(field => (
          <div key={field.key}>
            <label className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">
                {locale === 'zh-CN' ? field.labelZh : field.label}
                {field.required && <span className="ml-1 text-err">*</span>}
              </span>
              {field.helpUrl && (
                <a href={field.helpUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80">
                  {L(locale, '获取', 'Get one')} <ExternalLinkIcon />
                </a>
              )}
            </label>
            <Input
              value={values[field.key] || ''}
              onChange={e => setValues({ ...values, [field.key]: e.target.value })}
              type={field.secret ? 'password' : 'text'}
              placeholder={field.placeholder}
              className="font-mono text-[12px]"
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 border-t border-edge pt-3">
          <Button variant="ghost" onClick={onClose}>{L(locale, '取消', 'Cancel')}</Button>
          <Button variant="primary" disabled={submitting || missingRequired} onClick={submit}>
            {submitting ? <Spinner /> : L(locale, '保存并启用', 'Save & Enable')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CustomMcpDialog({
  open, onClose, locale, scope, workdir, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  scope: 'global' | 'workspace';
  workdir?: string;
  onAdded: () => void;
}) {
  const toast = useStore(s => s.toast);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [command, setCommand] = useState('npx');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [env, setEnv] = useState<Array<{ k: string; v: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(''); setTransport('stdio'); setCommand('npx'); setArgs(''); setUrl(''); setEnv([]);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const envObj: Record<string, string> = {};
      for (const { k, v } of env) if (k.trim()) envObj[k.trim()] = v;
      const config: McpServerConfig = transport === 'http'
        ? { type: 'http', url: url.trim(), enabled: true, ...(Object.keys(envObj).length ? { headers: envObj } : {}) }
        : {
            type: 'stdio',
            command: command.trim(),
            args: args.trim() ? args.trim().split(/\s+/) : [],
            enabled: true,
            ...(Object.keys(envObj).length ? { env: envObj } : {}),
          };
      await api.addCustomMcp(name.trim(), config, scope, workdir);
      toast(L(locale, `${name} 已添加`, `${name} added`), true);
      onAdded();
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Failed', false);
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalHeader
        title={L(locale, '添加自定义 MCP 服务', 'Add Custom MCP Server')}
        description={L(locale, '不在推荐列表中的自定义服务。', 'For servers not in the recommended catalog.')}
        onClose={onClose}
      />
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, '名称', 'Name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="my-server" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, '传输', 'Transport')}</label>
            <div className="flex gap-1.5">
              {(['stdio', 'http'] as const).map(t => (
                <button key={t}
                  onClick={() => setTransport(t)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors',
                    transport === t ? 'border-primary/40 bg-primary/10 text-primary' : 'border-edge bg-inset/50 text-fg-4 hover:bg-inset',
                  )}
                >{t}</button>
              ))}
            </div>
          </div>
        </div>
        {transport === 'stdio' ? (
          <>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, '命令', 'Command')}</label>
              <Input value={command} onChange={e => setCommand(e.target.value)} className="font-mono" placeholder="npx" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">{L(locale, '参数', 'Arguments')}</label>
              <Input value={args} onChange={e => setArgs(e.target.value)} className="font-mono" placeholder="-y @example/server" />
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">URL</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} className="font-mono" placeholder="https://example.com/mcp" />
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">
              {transport === 'http' ? L(locale, 'Headers', 'Headers') : L(locale, '环境变量', 'Env')}
            </span>
            <button className="text-[11px] font-medium text-primary hover:text-primary/80" onClick={() => setEnv([...env, { k: '', v: '' }])}>
              + {L(locale, '添加', 'Add')}
            </button>
          </div>
          {env.length > 0 && (
            <div className="space-y-1 rounded-md border border-edge bg-inset/40 p-2">
              {env.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input className="w-2/5 !h-7 !text-[12px] font-mono" value={row.k}
                    onChange={e => { const n = [...env]; n[i] = { ...n[i], k: e.target.value }; setEnv(n); }} placeholder="KEY" />
                  <Input className="flex-1 !h-7 !text-[12px] font-mono" value={row.v}
                    onChange={e => { const n = [...env]; n[i] = { ...n[i], v: e.target.value }; setEnv(n); }}
                    type={/token|secret|key|bearer/i.test(row.k) ? 'password' : 'text'} placeholder="value" />
                  <button className="shrink-0 rounded p-1 text-fg-5 hover:text-err" onClick={() => setEnv(env.filter((_, j) => j !== i))}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-edge pt-3">
          <Button variant="ghost" onClick={onClose}>{L(locale, '取消', 'Cancel')}</Button>
          <Button variant="primary" disabled={!name.trim() || submitting} onClick={submit}>
            {submitting ? <Spinner /> : L(locale, '添加', 'Add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


function ConnectedCard({
  item, locale, busy, index,
  onPrimary, onRemove, onReauth, onReconfigure,
}: {
  item: McpCatalogItem;
  locale: string;
  busy: boolean;
  index: number;
  onPrimary: () => void;
  onRemove?: () => void;
  onReauth?: () => void;
  onReconfigure?: () => void;
}) {
  const primaryLabel = (() => {
    switch (item.state) {
      case 'ready': return L(locale, '停用', 'Pause');
      case 'unhealthy': return L(locale, '停用', 'Pause');
      case 'disabled': return L(locale, '启用', 'Enable');
      case 'needs_auth':
        return item.auth.type === 'mcp-oauth' ? L(locale, '授权', 'Authorize') : L(locale, '配置', 'Configure');
      default: return L(locale, '启用', 'Enable');
    }
  })();

  const cardStyle: CSSProperties = {
    animationDelay: `${Math.min(index, 8) * 40}ms`,
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4',
        'transition-[background,border-color] duration-200',
        'hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)]',
        'animate-in-up',
      )}
      style={cardStyle}
    >
      <div className="relative flex items-start gap-3">
        <BrandAvatar iconSlug={item.iconSlug} iconUrl={item.iconUrl} name={item.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[14px] font-semibold text-fg">{item.name}</div>
            {item.homepage && (
              <a href={item.homepage} target="_blank" rel="noreferrer"
                 className="text-fg-5 hover:text-fg-3 transition-colors">
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
        <StatePill state={item.state} locale={locale} />
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-[var(--edge-subtle)] pt-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-fg-5">
          <span className="h-1.5 w-1.5 rounded-full bg-fg-6" />
          {authKindLabel(locale, item.auth)}
        </span>
        <div className="flex items-center gap-1">
          {item.installed && item.state !== 'needs_auth' && onReauth && (
            <Button variant="ghost" size="sm" onClick={onReauth} disabled={busy}>
              {L(locale, '重新授权', 'Re-auth')}
            </Button>
          )}
          {item.installed && item.state !== 'needs_auth' && onReconfigure && (
            <Button variant="ghost" size="sm" onClick={onReconfigure} disabled={busy}>
              {L(locale, '编辑', 'Edit')}
            </Button>
          )}
          <Button
            variant={item.state === 'disabled' || item.state === 'needs_auth' ? 'primary' : 'ghost'}
            size="sm"
            onClick={onPrimary}
            disabled={busy}
          >
            {busy ? <Spinner /> : primaryLabel}
          </Button>
          {item.installed && onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy} className="hover:!text-err">
              {L(locale, '移除', 'Remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AvailableCard({
  item, locale, busy, index, onPrimary,
}: {
  item: McpCatalogItem;
  locale: string;
  busy: boolean;
  index: number;
  onPrimary: () => void;
}) {
  const primaryLabel = item.auth.type === 'none'
    ? L(locale, '一键启用', 'One-click enable')
    : L(locale, '授权并启用', 'Authorize & enable');

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4',
        'transition-[background,border-color] duration-200',
        'hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)]',
        'animate-in-up',
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="flex items-start gap-3">
        <BrandAvatar iconSlug={item.iconSlug} iconUrl={item.iconUrl} name={item.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[13.5px] font-semibold text-fg">{item.name}</div>
            {item.homepage && (
              <a href={item.homepage} target="_blank" rel="noreferrer"
                 className="text-fg-5 hover:text-fg-3 transition-colors">
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-fg-5">
          {authKindLabel(locale, item.auth)}
        </span>
        <Button variant="outline" size="sm" onClick={onPrimary} disabled={busy}
                className="group-hover:border-edge-h">
          {busy ? <Spinner /> : primaryLabel}
        </Button>
      </div>
    </div>
  );
}


export function McpCatalogSection({
  scope, workdir, locale, onOpenBrowserSetup,
}: {
  scope: 'global' | 'workspace';
  workdir?: string;
  locale: string;
  onOpenBrowserSetup?: () => void;
}) {
  const toast = useStore(s => s.toast);
  const cacheKey = `pikiloom.mcp.catalog.${scope}.${workdir || ''}`;
  const { data, loading, refresh } = useCachedResource<McpCatalogItem[]>(
    cacheKey,
    async () => (await api.getMcpCatalog(workdir, scope)).items || [],
    [workdir, scope],
  );

  const [search, setSearch] = useState('');
  const [credsTarget, setCredsTarget] = useState<McpCatalogItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const items = data || [];
  const scopedItems = useMemo(() => {
    return items.filter(i => !i.installed || i.scope === scope || !i.scope);
  }, [items, scope]);

  const filtered = useMemo(() => {
    if (!search.trim()) return scopedItems;
    const q = search.trim().toLowerCase();
    return scopedItems.filter(i =>
      i.name.toLowerCase().includes(q)
      || i.description.toLowerCase().includes(q)
      || i.descriptionZh.includes(q)
      || i.id.toLowerCase().includes(q),
    );
  }, [scopedItems, search]);

  const builtinItems = useMemo(
    () => filtered.filter(i => i.isBuiltin),
    [filtered],
  );
  const activeItems = useMemo(
    () => filtered.filter(i => !i.isBuiltin && (i.state === 'ready' || i.state === 'unhealthy')),
    [filtered],
  );
  const availableGroups = useMemo(
    () => groupByCategory(filtered.filter(i => !i.isBuiltin && i.state !== 'ready' && i.state !== 'unhealthy')),
    [filtered],
  );

  const runInstall = useCallback(async (item: McpCatalogItem, credentials?: Record<string, string>) => {
    if (!item.isRecommended) return;
    setBusy(item.id);
    try {
      const r = await api.installMcp(item.id, scope, credentials, workdir, true);
      if (!r.ok) throw new Error(r.error || 'install failed');
      await refresh();
      return r.enabled ?? false;
    } catch (e: any) {
      toast(e?.message || 'Failed', false);
      return false;
    } finally { setBusy(null); }
  }, [scope, workdir, refresh, toast]);

  const runOAuth = useCallback(async (item: McpCatalogItem) => {
    setBusy(item.id);
    try {
      if (!item.installed) {
        const r = await api.installMcp(item.id, scope, undefined, workdir, false);
        if (!r.ok) throw new Error(r.error || 'install failed');
      }
      const start = await api.startMcpOAuth(item.id);
      if (!start.ok || !start.authUrl || !start.state) throw new Error(start.error || 'oauth start failed');
      const ok = await openOAuthPopup(start.authUrl, start.state);
      if (ok) {
        await api.toggleMcp(item.id, true, scope, workdir);
        toast(L(locale, `${item.name} 授权成功`, `${item.name} authorized`), true);
      } else {
        toast(L(locale, '授权未完成', 'Authorization not completed'), false);
      }
      await refresh();
    } catch (e: any) {
      toast(e?.message || 'OAuth failed', false);
    } finally { setBusy(null); }
  }, [scope, workdir, locale, toast, refresh]);

  const runToggle = useCallback(async (item: McpCatalogItem, enabled: boolean) => {
    if (!item.installedKey) return;
    setBusy(item.id);
    try {
      await api.toggleMcp(item.installedKey, enabled, item.scope === 'workspace' ? 'workspace' : 'global', workdir);
      await refresh();
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBusy(null); }
  }, [workdir, refresh, toast]);

  const runRemove = useCallback(async (item: McpCatalogItem) => {
    if (!item.installedKey) return;
    setBusy(item.id);
    try {
      await api.removeMcp(item.installedKey, item.scope === 'workspace' ? 'workspace' : 'global', item.isRecommended ? item.id : undefined, workdir);
      await refresh();
    } catch (e: any) { toast(e?.message || 'Failed', false); }
    finally { setBusy(null); }
  }, [workdir, refresh, toast]);

  const runCredentialsSubmit = useCallback(async (credentials: Record<string, string>) => {
    if (!credsTarget) return;
    const ok = await runInstall(credsTarget, credentials);
    if (ok !== false) setCredsTarget(null);
  }, [credsTarget, runInstall]);

  const handleConnectedPrimary = useCallback((item: McpCatalogItem) => {
    if (item.state === 'ready' || item.state === 'unhealthy') { void runToggle(item, false); return; }
    if (item.state === 'disabled') { void runToggle(item, true); return; }
    if (item.state === 'needs_auth') {
      if (item.auth.type === 'mcp-oauth') { void runOAuth(item); return; }
      if (item.auth.type === 'credentials') { setCredsTarget(item); return; }
    }
  }, [runToggle, runOAuth]);

  const handleAvailablePrimary = useCallback((item: McpCatalogItem) => {
    if (item.state === 'disabled') { void runToggle(item, true); return; }
    if (item.state === 'needs_auth') {
      if (item.auth.type === 'mcp-oauth') { void runOAuth(item); return; }
      if (item.auth.type === 'credentials') { setCredsTarget(item); return; }
    }
    if (item.auth.type === 'mcp-oauth') { void runOAuth(item); return; }
    if (item.auth.type === 'credentials') { setCredsTarget(item); return; }
    void runInstall(item);
  }, [runOAuth, runInstall, runToggle]);

  const showSpinner = loading && !data;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <SectionLabel>MCP Servers</SectionLabel>
          {!loading && (
            <span className="text-[11px] text-fg-5">
              {activeItems.length} {L(locale, '在用', 'in use')} · {scopedItems.length - activeItems.length - builtinItems.length} {L(locale, '可添加', 'available')}
            </span>
          )}
          {loading && <Spinner className="h-3 w-3" />}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                 className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-5">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L(locale, '搜索...', 'Search...')}
              className="h-7 w-52 rounded-md border border-edge bg-inset/50 pl-7 pr-2.5 text-[12px] text-fg outline-none placeholder:text-fg-5/50 focus:border-primary/30 focus:bg-inset"
            />
          </div>
        </div>
      </div>

      {showSpinner ? (
        <div className="flex items-center justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          {builtinItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--th-accent,#7c3aed)]"></span>
                {L(locale, '内置（pikiloom 优化）', 'Built-in (optimized by pikiloom)')}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {builtinItems.map((item, i) => (
                  item.installed ? (
                    <ConnectedCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      busy={busy === item.id}
                      index={i}
                      onPrimary={() => handleConnectedPrimary(item)}
                      onReconfigure={item.id === 'pikiloom-browser' ? onOpenBrowserSetup : undefined}
                    />
                  ) : (
                    <AvailableCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      busy={busy === item.id}
                      index={i}
                      onPrimary={() => handleAvailablePrimary(item)}
                    />
                  )
                ))}
              </div>
            </div>
          )}

          {activeItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--th-ok)]"></span>
                {L(locale, '在用', 'In use')}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeItems.map((item, i) => (
                  <ConnectedCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    busy={busy === item.id}
                    index={i}
                    onPrimary={() => handleConnectedPrimary(item)}
                    onRemove={() => void runRemove(item)}
                    onReauth={item.auth.type === 'mcp-oauth' ? () => void runOAuth(item) : undefined}
                    onReconfigure={item.auth.type === 'credentials' ? () => setCredsTarget(item) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {availableGroups.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-5">
                <span className="h-1.5 w-1.5 rounded-full bg-fg-5"></span>
                {activeItems.length === 0
                  ? L(locale, '推荐的服务', 'Recommended services')
                  : L(locale, '更多可选', 'More options')}
              </div>
              <div className="space-y-4">
                {availableGroups.map(group => (
                  <CategoryGroup key={group.key} groupKey={group.key} locale={locale}>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((item, i) => (
                        <AvailableCard
                          key={item.id}
                          item={item}
                          locale={locale}
                          busy={busy === item.id}
                          index={i}
                          onPrimary={() => handleAvailablePrimary(item)}
                        />
                      ))}
                    </div>
                  </CategoryGroup>
                ))}
              </div>
            </div>
          )}

          {builtinItems.length === 0 && activeItems.length === 0 && availableGroups.length === 0 && (
            <EmptyState
              title={L(locale, '没有匹配的服务', 'No matching services')}
              subtitle={L(locale, '试试别的关键词', 'Try a different search term')}
            />
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          className="text-[12px] text-fg-4 hover:text-fg-2 transition-colors"
          onClick={() => setCustomOpen(true)}
        >
          + {L(locale, '添加自定义 MCP', 'Add custom MCP')}
        </button>
      </div>

      <CredentialsDialog
        open={!!credsTarget}
        onClose={() => setCredsTarget(null)}
        locale={locale}
        item={credsTarget}
        initial={credsTarget?.config?.env || credsTarget?.config?.headers}
        onSubmit={runCredentialsSubmit}
      />
      <CustomMcpDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        locale={locale}
        scope={scope}
        workdir={workdir}
        onAdded={refresh}
      />
    </section>
  );
}

