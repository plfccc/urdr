import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { CliCatalogItem } from '../../types';
import { Button, Input, Modal, ModalHeader, Spinner, SectionLabel } from '../../components/ui';
import { L, useCachedResource, ExternalLinkIcon, CheckCircleIcon, LockIcon, BrandAvatar, EmptyState } from './shared';

// External CLI tools: catalog section, cards, install and sign-in panels.
// Split out of ExtensionsTab.tsx; contents moved verbatim.

const CLI_CATEGORY_META: Record<string, { zh: string; en: string; order: number }> = {
  dev:      { zh: '研发工具', en: 'Developer', order: 1 },
  cloud:    { zh: '云与部署', en: 'Cloud',     order: 2 },
  data:     { zh: '数据后端', en: 'Data',      order: 3 },
  commerce: { zh: '商业支付', en: 'Commerce',  order: 4 },
  social:   { zh: '社交通讯', en: 'Social',    order: 5 },
  content:  { zh: '内容创作', en: 'Content',   order: 6 },
};

function cliStatePill({
  state,
  locale,
}: { state: CliCatalogItem['state']; locale: string }) {
  if (state === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-ok)]"
            style={{ background: 'color-mix(in oklab, var(--th-ok) 12%, transparent)' }}>
        <CheckCircleIcon size={10} />{L(locale, '已登录', 'Signed in')}
      </span>
    );
  }
  if (state === 'installed_not_auth') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
            style={{ background: 'color-mix(in oklab, #f59e0b 14%, transparent)' }}>
        <LockIcon size={10} />{L(locale, '待登录', 'Sign-in needed')}
      </span>
    );
  }
  if (state === 'not_installed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-inset/60 px-2 py-0.5 text-[10px] font-medium text-fg-5">
        {L(locale, '未安装', 'Not installed')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-inset/60 px-2 py-0.5 text-[10px] font-medium text-fg-5">
      ...
    </span>
  );
}

function StreamingTerminal({
  chunks,
  running,
  emptyHint,
}: { chunks: string[]; running: boolean; emptyHint?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [chunks.length]);
  const text = chunks.join('');
  return (
    <div
      ref={containerRef}
      className="relative h-56 overflow-auto rounded-xl border border-edge/60 bg-[#0b0f16] p-3 font-mono text-[11.5px] leading-[1.55] text-[#cdd6f4] scrollbar-thin"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset' }}
    >
      {!text ? (
        <div className="flex h-full items-center justify-center text-[#6c7086]">
          {running ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> {emptyHint || 'Starting…'}
            </span>
          ) : (emptyHint || 'No output yet')}
        </div>
      ) : (
        <pre className="whitespace-pre-wrap break-words">{text}</pre>
      )}
    </div>
  );
}

function CliInstallPanel({
  cli,
  locale,
  onInstalled,
}: {
  cli: CliCatalogItem;
  locale: string;
  onInstalled: () => void;
}) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [doneOk, setDoneOk] = useState<boolean | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    try { sourceRef.current?.close(); } catch {  }
    sourceRef.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const startInstall = useCallback(async () => {
    setChunks([]);
    setErrorMsg(null);
    setDoneOk(null);
    setRunning(true);
    try {
      const r = await api.startCliInstall(cli.id);
      if (!r.ok || !r.sessionId) throw new Error(r.error || 'start failed');
      setSessionId(r.sessionId);
      const es = new EventSource(`/api/extensions/cli/auth/stream?sessionId=${encodeURIComponent(r.sessionId)}`);
      sourceRef.current = es;
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (ev.type === 'output') {
            setChunks(prev => prev.length > 400 ? [...prev.slice(-400), ev.chunk] : [...prev, ev.chunk]);
          } else if (ev.type === 'error') {
            setErrorMsg(ev.message || 'error');
          } else if (ev.type === 'done') {
            setRunning(false);
            setDoneOk(!!ev.ok);
            cleanup();
            if (ev.ok) onInstalled();
          }
        } catch {  }
      };
      es.addEventListener('close', () => {
        setRunning(false);
        cleanup();
      });
      es.onerror = () => {
        if (!running) return;
        setErrorMsg(L(locale, '连接中断', 'Stream disconnected'));
      };
    } catch (e: any) {
      setRunning(false);
      setErrorMsg(e?.message || 'failed to start install');
    }
  }, [cli.id, cleanup, locale, onInstalled, running]);

  const cancelInstall = useCallback(async () => {
    if (sessionId) {
      try { await api.cancelCliAuth(sessionId); } catch {  }
    }
    cleanup();
    setRunning(false);
  }, [sessionId, cleanup]);

  if (!cli.autoInstall) return null;

  const showTerminal = running || chunks.length > 0 || doneOk !== null;

  return (
    <div className="space-y-3 rounded-lg border border-edge/70 bg-panel/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-fg-3">
          {L(locale,
            `通过 ${cli.autoInstall.label} 直接在本机自动安装，无需复制命令。`,
            `Run the ${cli.autoInstall.label} install locally — no copy-paste needed.`)}
        </div>
        {!running ? (
          <Button variant="primary" size="sm" onClick={startInstall} disabled={doneOk === true}>
            {doneOk === true
              ? L(locale, '已安装', 'Installed')
              : doneOk === false
                ? L(locale, '重试安装', 'Retry install')
                : L(locale, '一键安装', 'Auto-install')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={cancelInstall}>
            {L(locale, '中止', 'Abort')}
          </Button>
        )}
      </div>
      {showTerminal && (
        <StreamingTerminal
          chunks={chunks}
          running={running}
          emptyHint={L(locale, '安装进度将在此显示', 'Install output will appear here')}
        />
      )}
      {errorMsg && (
        <div className="text-[12px] text-[var(--th-err)]">{errorMsg}</div>
      )}
      {doneOk === false && !errorMsg && (
        <div className="text-[12px] text-[var(--th-err)]">
          {L(locale, '安装未成功，请查看上方输出排查。', 'Install did not complete — check the output above.')}
        </div>
      )}
    </div>
  );
}

function CliManualSignInPanel({
  cliId,
  locale,
  hint,
  commands,
  onSignedIn,
  onCancel,
}: {
  cliId: string;
  locale: string;
  hint?: string;
  commands: { label?: string; cmd: string }[];
  onSignedIn: () => void;
  onCancel: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    setCheckMsg(null);
    setErrorMsg(null);
    try {
      const r = await api.refreshCli(cliId);
      if (!r.ok) {
        setErrorMsg(r.error || L(locale, '检测失败', 'Detection failed'));
        return;
      }
      if (r.status?.state === 'ready') {
        onSignedIn();
        return;
      }
      const stepCount = commands.length;
      setCheckMsg(stepCount > 1
        ? L(
            locale,
            `尚未检测到登录。请依次完成上面 ${stepCount} 步后再重试 —— 任一步漏掉都不会算授权成功。`,
            `Not signed in yet. Run all ${stepCount} steps above in order — sign-in only counts as successful after every step completes.`,
          )
        : L(
            locale,
            '尚未检测到登录，请先在终端完成上述命令。',
            'Not signed in yet — finish the command above in your terminal first.',
          ));
    } catch (e: any) {
      setErrorMsg(e?.message || 'failed');
    } finally {
      setChecking(false);
    }
  }, [cliId, locale, onSignedIn, commands.length]);

  return (
    <div className="space-y-3">
      {hint && <div className="text-[12px] leading-relaxed text-fg-4">{hint}</div>}
      <InstallCommandBlock commands={commands} locale={locale} />
      {errorMsg && <div className="text-[12px] text-[var(--th-err)]">{errorMsg}</div>}
      {checkMsg && !errorMsg && <div className="text-[12px] text-fg-4">{checkMsg}</div>}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={recheck} disabled={checking}>
          <span className="inline-flex items-center gap-1.5">
            {checking && (
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="animate-spin"
                style={{ animationDuration: '0.9s' }}
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            <span>
              {checking
                ? L(locale, '检测中…', 'Checking…')
                : L(locale, '重新检测状态', 'Re-check status')}
            </span>
          </span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={checking}>
          {L(locale, '关闭', 'Close')}
        </Button>
      </div>
    </div>
  );
}

function CliSignInPanel({
  cli,
  locale,
  onSignedIn,
  onCancel,
}: {
  cli: CliCatalogItem;
  locale: string;
  onSignedIn: () => void;
  onCancel: () => void;
}) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    try { sourceRef.current?.close(); } catch {  }
    sourceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startOAuth = useCallback(async () => {
    setChunks([]);
    setErrorMsg(null);
    setStatusLine(null);
    setRunning(true);
    try {
      const r = await api.startCliAuth(cli.id);
      if (!r.ok || !r.sessionId) throw new Error(r.error || 'start failed');
      setSessionId(r.sessionId);
      const es = new EventSource(`/api/extensions/cli/auth/stream?sessionId=${encodeURIComponent(r.sessionId)}`);
      sourceRef.current = es;
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (ev.type === 'output') {
            setChunks(prev => prev.length > 400 ? [...prev.slice(-400), ev.chunk] : [...prev, ev.chunk]);
          } else if (ev.type === 'status') {
            setStatusLine(ev.status.state === 'ready'
              ? L(locale, '已检测到登录成功', 'Sign-in detected')
              : L(locale, '等待授权完成…', 'Waiting for authorization…'));
          } else if (ev.type === 'error') {
            setErrorMsg(ev.message || 'error');
          } else if (ev.type === 'done') {
            setRunning(false);
            cleanup();
            if (ev.ok) onSignedIn();
          }
        } catch {  }
      };
      es.addEventListener('close', () => {
        setRunning(false);
        cleanup();
      });
      es.onerror = () => {
        if (!running) return;
        setErrorMsg(L(locale, '连接中断', 'Stream disconnected'));
      };
    } catch (e: any) {
      setRunning(false);
      setErrorMsg(e?.message || 'failed to start sign-in');
    }
  }, [cli.id, cleanup, locale, onSignedIn, running]);

  const cancelOAuth = useCallback(async () => {
    if (sessionId) {
      try { await api.cancelCliAuth(sessionId); } catch {  }
    }
    cleanup();
    setRunning(false);
    onCancel();
  }, [sessionId, cleanup, onCancel]);

  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const applyToken = useCallback(async () => {
    setApplying(true);
    setErrorMsg(null);
    try {
      const r = await api.applyCliToken(cli.id, tokenValues);
      if (r.ok) onSignedIn();
      else setErrorMsg(r.error || L(locale, '应用凭据失败', 'Failed to apply credentials'));
    } catch (e: any) {
      setErrorMsg(e?.message || 'failed');
    } finally {
      setApplying(false);
    }
  }, [cli.id, tokenValues, locale, onSignedIn]);

  if (cli.auth.type === 'oauth-web') {
    const hint = locale === 'zh-CN' ? (cli.auth.loginHintZh || cli.auth.loginHint) : cli.auth.loginHint;
    const manualCommands = cli.auth.manualLoginCommands;
    if (manualCommands && manualCommands.length > 0) {
      return (
        <CliManualSignInPanel
          cliId={cli.id}
          locale={locale}
          hint={hint}
          commands={manualCommands}
          onSignedIn={onSignedIn}
          onCancel={onCancel}
        />
      );
    }
    return (
      <div className="space-y-3">
        {hint && <div className="text-[12px] leading-relaxed text-fg-4">{hint}</div>}
        <StreamingTerminal
          chunks={chunks}
          running={running}
          emptyHint={L(locale, '点击「开始登录」后将在此展示命令行输出', 'Click "Start sign-in" to stream CLI output here')}
        />
        {errorMsg && (
          <div className="text-[12px] text-[var(--th-err)]">{errorMsg}</div>
        )}
        {statusLine && !errorMsg && (
          <div className="text-[12px] text-[var(--th-ok)]">{statusLine}</div>
        )}
        <div className="flex items-center gap-2">
          {!running ? (
            <>
              <Button variant="primary" size="sm" onClick={startOAuth}>
                {L(locale, '开始登录', 'Start sign-in')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                {L(locale, '取消', 'Cancel')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={cancelOAuth}>
              {L(locale, '中止', 'Abort')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (cli.auth.type === 'token') {
    const hint = locale === 'zh-CN' ? (cli.auth.loginHintZh || cli.auth.loginHint) : cli.auth.loginHint;
    return (
      <div className="space-y-3">
        {hint && <div className="text-[12px] leading-relaxed text-fg-4">{hint}</div>}
        <div className="space-y-2">
          {(cli.auth.tokenFields || []).map(f => (
            <label key={f.key} className="block text-[12px]">
              <div className="mb-1 text-fg-3">
                {locale === 'zh-CN' ? f.labelZh : f.label}
                {f.required && <span className="ml-1 text-[var(--th-err)]">*</span>}
              </div>
              <Input
                type={f.secret ? 'password' : 'text'}
                value={tokenValues[f.key] || ''}
                onChange={e => setTokenValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ''}
                className="w-full"
              />
              {f.helpUrl && (
                <a className="mt-1 inline-block text-[11px] text-primary hover:underline" href={f.helpUrl} target="_blank" rel="noreferrer">
                  {L(locale, '如何获取', 'How to get this')} ↗
                </a>
              )}
            </label>
          ))}
        </div>
        {errorMsg && (
          <div className="text-[12px] text-[var(--th-err)]">{errorMsg}</div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={applyToken} disabled={applying}>
            {applying ? L(locale, '验证中…', 'Verifying…') : L(locale, '保存并验证', 'Save & verify')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>{L(locale, '取消', 'Cancel')}</Button>
        </div>
      </div>
    );
  }

  return null;
}

function InstallCommandBlock({ commands, locale }: { commands: { cmd: string; label?: string }[]; locale: string }) {
  return (
    <div className="space-y-2">
      {commands.map((c, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-edge/70 bg-panel/60">
          {c.label && (
            <div className="flex items-center justify-between border-b border-edge/50 bg-panel-alt/40 px-3 py-1 text-[11px] font-medium text-fg-4">
              <span>{c.label}</span>
            </div>
          )}
          <div className="flex items-start gap-2 px-3 py-2 font-mono text-[12px] text-fg-2">
            <span className="mt-[2px] select-none text-fg-5">$</span>
            <code className="min-w-0 flex-1 break-all">{c.cmd}</code>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(c.cmd); }}
              className="shrink-0 rounded px-2 py-0.5 text-[10.5px] text-fg-5 transition-colors hover:bg-panel-h hover:text-fg-2"
              title={L(locale, '复制到剪贴板', 'Copy to clipboard')}
            >
              {L(locale, '复制', 'Copy')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CliDetailModal({
  cli,
  open,
  onClose,
  onChanged,
  locale,
}: {
  cli: CliCatalogItem | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  locale: string;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutErr, setLogoutErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSigningIn(false); setLogoutErr(null); }
  }, [open]);

  const platformCommands = useMemo(() => {
    if (!cli) return [];
    return cli.install[cli.platform] || [];
  }, [cli]);

  if (!cli) return null;

  const installed = cli.state !== 'not_installed';
  const ready = cli.state === 'ready';

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutErr(null);
    try {
      const r = await api.logoutCli(cli.id);
      if (!r.ok) setLogoutErr(r.error || L(locale, '登出失败', 'Logout failed'));
      onChanged();
    } catch (e: any) {
      setLogoutErr(e?.message || 'failed');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide>
      <ModalHeader
        title={cli.name}
        description={locale === 'zh-CN' ? cli.descriptionZh : cli.description}
        onClose={onClose}
      />
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <BrandAvatar iconSlug={cli.iconSlug} iconUrl={cli.iconUrl} name={cli.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              {cli.name}
              {cli.homepage && (
                <a href={cli.homepage} target="_blank" rel="noreferrer" className="text-fg-5 hover:text-primary">
                  <ExternalLinkIcon />
                </a>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-4">
              {cliStatePill({ state: cli.state, locale })}
              {cli.version && <span className="font-mono text-fg-5">v{cli.version}</span>}
              {ready && cli.authDetail && (
                <span className="truncate text-fg-5">· {cli.authDetail}</span>
              )}
            </div>
          </div>
        </div>

        {!installed && (
          <section className="space-y-3">
            <div className="text-[12px] font-semibold text-fg-3">
              {L(locale, '安装', 'Install')}
            </div>
            {cli.autoInstall && (
              <CliInstallPanel cli={cli} locale={locale} onInstalled={onChanged} />
            )}
            <div className="text-[11.5px] leading-relaxed text-fg-5">
              {cli.autoInstall
                ? L(locale,
                    '或手动复制命令到终端执行。',
                    'Or copy a command below and run it in your terminal.')
                : L(locale,
                    '复制下面的命令到终端运行。我们不自动代为安装 — 包管理器往往需要 sudo 或交互式确认。',
                    'Copy a command below and run it in your terminal. We don\'t auto-install — package managers often need sudo or interactive confirmation.')}
            </div>
            {platformCommands.length > 0 ? (
              <InstallCommandBlock commands={platformCommands} locale={locale} />
            ) : (
              <div className="text-[12px] text-fg-5">
                {L(locale, '请查看官方文档', 'Check the official installation docs')}
              </div>
            )}
            {cli.install.docs && (
              <a href={cli.install.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline">
                {L(locale, '查看安装文档', 'Installation docs')} ↗
              </a>
            )}
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onChanged}>
                {L(locale, '我已安装，重新检测', "I've installed, re-check")}
              </Button>
            </div>
          </section>
        )}

        {installed && cli.auth.type !== 'none' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-fg-3">
                {L(locale, '登录', 'Sign in')}
              </div>
              {ready && !signingIn && (
                <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
                  {loggingOut ? L(locale, '登出中…', 'Signing out…') : L(locale, '登出', 'Sign out')}
                </Button>
              )}
            </div>
            {logoutErr && <div className="text-[11.5px] text-[var(--th-err)]">{logoutErr}</div>}
            {ready && !signingIn ? (
              <div className="rounded-lg border border-edge/70 bg-panel/60 p-3 text-[12px] text-fg-3">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon size={12} />
                  <span>{L(locale, '你已经登录，命令行工具可直接使用。', 'Already signed in — the CLI is ready to use.')}</span>
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => setSigningIn(true)}>
                    {L(locale, '重新登录', 'Re-authenticate')}
                  </Button>
                </div>
              </div>
            ) : (
              <CliSignInPanel
                cli={cli}
                locale={locale}
                onSignedIn={() => { setSigningIn(false); onChanged(); }}
                onCancel={() => setSigningIn(false)}
              />
            )}
          </section>
        )}

        {installed && cli.auth.type === 'none' && (
          <section className="rounded-lg border border-edge/70 bg-panel/60 p-3 text-[12px] text-fg-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon size={12} />
              <span>{L(locale, '无需授权 — 可直接使用。', 'No authentication required — ready to use.')}</span>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function CliConnectedCard({
  item,
  onClick,
  locale,
  animationDelay,
}: { item: CliCatalogItem; onClick: () => void; locale: string; animationDelay?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-in-up group relative flex min-h-[112px] w-full flex-col overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4 text-left transition-[background,border-color] duration-200 hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--brand-glow-a)]"
      style={{ animationDelay }}
    >
      <div className="relative flex items-start gap-3">
        <BrandAvatar iconSlug={item.iconSlug} iconUrl={item.iconUrl} name={item.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[13px] font-semibold text-fg">{item.name}</div>
            {cliStatePill({ state: item.state, locale })}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-5">
            {item.version ? <span className="font-mono">v{item.version}</span> : null}
            {item.version && item.authDetail ? ' · ' : null}
            {item.authDetail}
          </div>
          <div className="mt-1 truncate text-[11.5px] text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
      </div>
    </button>
  );
}

function CliAvailableCard({
  item,
  onClick,
  locale,
  animationDelay,
}: { item: CliCatalogItem; onClick: () => void; locale: string; animationDelay?: string }) {
  const cta = item.state === 'not_installed'
    ? L(locale, '安装', 'Install')
    : item.state === 'installed_not_auth' ? L(locale, '登录', 'Sign in')
    : L(locale, '查看', 'Details');
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-in-up group relative flex min-h-[112px] w-full flex-col overflow-hidden rounded-lg border border-[var(--edge-subtle)] bg-[var(--surface-2)] p-4 text-left transition-[background,border-color] duration-200 hover:border-[var(--edge-default)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--brand-glow-a)]"
      style={{ animationDelay }}
    >
      <div className="flex items-start gap-3">
        <BrandAvatar iconSlug={item.iconSlug} iconUrl={item.iconUrl} name={item.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-fg">{item.name}</span>
            {item.homepage && (
              <a href={item.homepage} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-fg-5 transition-colors hover:text-primary">
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-4">
            {locale === 'zh-CN' ? item.descriptionZh : item.description}
          </div>
        </div>
      </div>
      <div className="mt-auto pt-3 flex items-center justify-between">
        <span className="text-[11px] text-fg-5">
          {item.auth.type === 'oauth-web' ? L(locale, '浏览器授权', 'OAuth')
            : item.auth.type === 'token' ? L(locale, 'Token', 'Token')
            : L(locale, '免配置', 'No auth')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--edge-subtle)] bg-transparent px-2.5 py-1 text-[11px] font-semibold text-fg-3 transition-colors group-hover:border-[var(--edge-default)] group-hover:text-fg">
          {cta}
        </span>
      </div>
    </button>
  );
}

export function CliCatalogSection({
  locale,
  scope,
}: {
  locale: string;
  scope: 'global' | 'workspace';
}) {
  const { data, loading, refresh } = useCachedResource<CliCatalogItem[]>(
    `urdr:cli:catalog`,
    async () => {
      const r = await api.getCliCatalog();
      if (!r.ok) throw new Error(r.error || 'failed');
      return r.items || [];
    },
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => {
    const all = data || [];
    if (scope === 'workspace') return all;
    return all;
  }, [data, scope]);
  const selected = selectedId ? items.find(i => i.id === selectedId) || null : null;

  const connected = items.filter(i => i.state === 'ready');
  const available = items.filter(i => i.state !== 'ready');
  const groupedAvailable = useMemo(() => {
    const map = new Map<string, CliCatalogItem[]>();
    for (const it of available) {
      const k = it.category;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return [...map.entries()].sort(([a], [b]) => (CLI_CATEGORY_META[a]?.order ?? 99) - (CLI_CATEGORY_META[b]?.order ?? 99));
  }, [available]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>{L(locale, 'CLI 工具', 'CLI Tools')}</SectionLabel>
        <div className="flex items-center gap-3 text-[11px] text-fg-5">
          <span>{connected.length} {L(locale, '已登录', 'signed in')} · {available.length} {L(locale, '可用', 'available')}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded px-2 py-0.5 text-fg-5 transition-colors hover:bg-panel-h hover:text-fg-2"
          >
            {loading ? L(locale, '刷新中…', 'Refreshing…') : L(locale, '刷新', 'Refresh')}
          </button>
        </div>
      </div>

      {scope === 'workspace' && (
        <div className="rounded-lg border border-edge/60 bg-inset/40 px-3 py-2 text-[11.5px] text-fg-4">
          {L(locale,
            'CLI 工具安装于机器层面，项目视图下同样可见。',
            'CLI tools are installed machine-wide and are shown here for convenience.')}
        </div>
      )}

      {connected.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--th-ok)]"></span>
            {L(locale, '已登录', 'Signed in')}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connected.map((c, i) => (
              <CliConnectedCard
                key={c.id}
                item={c}
                locale={locale}
                animationDelay={`${Math.min(i, 12) * 30}ms`}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-5/50"></span>
            {L(locale, '推荐工具', 'Available')}
          </div>
          {groupedAvailable.map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-5">
                {locale === 'zh-CN' ? (CLI_CATEGORY_META[cat]?.zh || cat) : (CLI_CATEGORY_META[cat]?.en || cat)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((item, i) => (
                  <CliAvailableCard
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

      {!loading && items.length === 0 && (
        <EmptyState
          title={L(locale, '暂无可用 CLI', 'No CLI tools available')}
          subtitle={L(locale, '稍后再试，或重启一下服务。', 'Try again later, or restart the service.')}
        />
      )}

      <CliDetailModal
        cli={selected}
        open={!!selected}
        onClose={() => setSelectedId(null)}
        onChanged={() => { void refresh(); }}
        locale={locale}
      />
    </section>
  );
}

