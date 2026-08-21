import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { McpAuthSpec, McpCatalogItem, McpCatalogState } from '../../types';
import { cn } from '../../utils';
import { BrandIcon } from '../../components/BrandIcon';

// Shared building blocks for the MCP / Skills / CLI sections of the Extensions page.
// Split out of a single 2.8k-line ExtensionsTab.tsx; contents moved verbatim.
export function L(locale: string, zh: string, en: string): string {
  return locale === 'zh-CN' ? zh : en;
}

export function authKindLabel(locale: string, auth: McpAuthSpec): string {
  if (auth.type === 'mcp-oauth') return L(locale, 'OAuth', 'OAuth');
  if (auth.type === 'credentials') return L(locale, 'API Key', 'API Key');
  return L(locale, '无需配置', 'No auth');
}

export const BRAND_PALETTE: Record<string, { hex: string; letter?: string }> = {
  github:           { hex: '#24292f', letter: 'GH' },
  atlassian:        { hex: '#0052cc', letter: 'A' },
  notion:           { hex: '#111827', letter: 'N' },
  linear:           { hex: '#5e6ad2', letter: 'L' },
  sentry:           { hex: '#362d59', letter: 'S' },
  cloudflare:       { hex: '#f6821f', letter: 'CF' },
  gamma:            { hex: '#9f2eff', letter: 'G' },
  huggingface:      { hex: '#ff9d00', letter: 'HF' },
  slack:            { hex: '#4a154b', letter: 'S' },
  lark:             { hex: '#00d6b9', letter: 'L' },
  feishu:           { hex: '#00d6b9', letter: 'F' },
  gmail:            { hex: '#ea4335', letter: 'G' },
  outlook:          { hex: '#0078d4', letter: 'O' },
  stripe:           { hex: '#635bff', letter: 'S' },
  perplexity:       { hex: '#20b8cd', letter: 'P' },
  brave:            { hex: '#fb542b', letter: 'B' },
  filesystem:       { hex: '#64748b', letter: 'FS' },
  fetch:            { hex: '#0ea5e9', letter: 'F' },
  memory:           { hex: '#a855f7', letter: 'M' },
  time:             { hex: '#10b981', letter: 'T' },
  sqlite:           { hex: '#0369a1', letter: 'SQ' },
  postgres:         { hex: '#336791', letter: 'PG' },
};

const DEFAULT_BRAND: { hex: string; letter?: string } = { hex: '#6b7280' };

export function brandInfo(slug?: string, fallbackName?: string) {
  const key = (slug || '').toLowerCase();
  const brand = BRAND_PALETTE[key] || DEFAULT_BRAND;
  const letter = brand.letter
    || (fallbackName || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase()
    || '?';
  return { hex: brand.hex, letter };
}

export function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3
    ? m.split('').map(c => c + c).join('')
    : m.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetcher();
      if (!mountedRef.current) return;
      setData(next);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {  }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refresh]);

  return { data, loading, refresh };
}

export const ExternalLinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const CheckCircleIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const PowerIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

export const LockIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

export const AlertIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export const UpdateIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export const LOCAL_BRAND_SLUGS = new Set([
  'claude', 'codex', 'telegram', 'feishu',
  'playwright', 'vscode', 'cursor', 'windsurf', 'finder',
]);

const ICONIFY_ICONS: Record<string, string> = {
  github:                    'logos:github-icon',
  atlassian:                 'logos:atlassian',
  notion:                    'logos:notion-icon',
  linear:                    'logos:linear-icon',
  sentry:                    'logos:sentry-icon',
  cloudflare:                'logos:cloudflare-icon',
  'cloudflare-docs':         'logos:cloudflare-icon',
  'cloudflare-bindings':     'logos:cloudflare-icon',
  'cloudflare-observability':'logos:cloudflare-icon',
  slack:                     'logos:slack-icon',
  lark:                      'icon-park:lark',
  feishu:                    'icon-park:lark',
  gmail:                     'logos:google-gmail',
  outlook:                   'vscode-icons:file-type-outlook',
  stripe:                    'logos:stripe',
  perplexity:                'logos:perplexity-icon',
  brave:                     'logos:brave',
  'brave-search':            'logos:brave',
  huggingface:               'logos:hugging-face-icon',
  postgres:                  'logos:postgresql',
  postgresql:                'logos:postgresql',
  sqlite:                    'logos:sqlite',
  vercel:                    'logos:vercel-icon',
  netlify:                   'logos:netlify-icon',
  supabase:                  'logos:supabase-icon',
  heroku:                    'logos:heroku-icon',
  docker:                    'logos:docker-icon',
  pnpm:                      'logos:pnpm',
  aws:                       'logos:aws',
  'google-cloud':            'logos:google-cloud',
  googlecloud:               'logos:google-cloud',
  amazonwebservices:         'logos:aws',
};

export const WORDMARK_ICONS = new Set(['stripe']);

export function resolveBrandLogoUrl(iconSlug?: string, iconUrl?: string): string | undefined {
  if (iconUrl) return iconUrl;
  if (!iconSlug) return undefined;
  if (LOCAL_BRAND_SLUGS.has(iconSlug)) return undefined;
  const iconId = ICONIFY_ICONS[iconSlug];
  if (!iconId) return undefined;
  return `https://api.iconify.design/${iconId}.svg`;
}

export function BrandAvatar({
  iconSlug,
  iconUrl,
  name,
  size = 32,
  className,
}: { iconSlug?: string; iconUrl?: string; name: string; size?: number; className?: string }) {
  const { hex, letter } = brandInfo(iconSlug, name);
  const [imgFailed, setImgFailed] = useState(false);
  const remoteUrl = resolveBrandLogoUrl(iconSlug, iconUrl);
  const useLocalBrand = iconSlug && LOCAL_BRAND_SLUGS.has(iconSlug);
  const useRemote = !!remoteUrl && !imgFailed;
  const useRealLogo = useLocalBrand || useRemote;
  const isWordmark = !!iconSlug && WORDMARK_ICONS.has(iconSlug);
  const logoSize = Math.round(size * (isWordmark ? 0.92 : 0.76));

  if (useRealLogo) {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white',
          className,
        )}
        style={{
          width: size,
          height: size,
          boxShadow: `0 0 0 1px ${withAlpha(hex, 0.18)}, 0 4px 12px ${withAlpha(hex, 0.14)}`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${withAlpha(hex, 0.06)} 0%, transparent 70%)` }}
        />
        {useLocalBrand ? (
          <BrandIcon brand={iconSlug!} size={logoSize} />
        ) : (
          <img
            src={remoteUrl}
            alt=""
            width={logoSize}
            height={logoSize}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="relative"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-semibold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${withAlpha(hex, 1)} 0%, ${withAlpha(hex, 0.82)} 100%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.08) inset, 0 6px 14px ${withAlpha(hex, 0.28)}`,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        letterSpacing: letter.length > 1 ? '-0.02em' : 0,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.22), transparent 55%)' }}
      />
      <span className="relative">{letter}</span>
    </div>
  );
}

export function StatePill({ state, locale }: { state: McpCatalogState; locale: string }) {
  if (state === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-ok)]"
            style={{ background: 'color-mix(in oklab, var(--th-ok) 12%, transparent)' }}>
        <CheckCircleIcon size={10} />{L(locale, '已连接', 'Connected')}
      </span>
    );
  }
  if (state === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-inset/60 px-2 py-0.5 text-[10px] font-medium text-fg-5">
        <PowerIcon size={10} />{L(locale, '已停用', 'Paused')}
      </span>
    );
  }
  if (state === 'needs_auth') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-warn)]"
            style={{ background: 'color-mix(in oklab, var(--th-warn) 12%, transparent)' }}>
        <LockIcon size={10} />{L(locale, '待授权', 'Needs auth')}
      </span>
    );
  }
  if (state === 'unhealthy') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--th-err)]"
            style={{ background: 'color-mix(in oklab, var(--th-err) 12%, transparent)' }}>
        <AlertIcon size={10} />{L(locale, '异常', 'Unhealthy')}
      </span>
    );
  }
  return null;
}


export function openOAuthPopup(authUrl: string, expectedState: string): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open(authUrl, 'urdr_mcp_oauth', 'width=640,height=780,noopener=no');
    if (!popup) { resolve(false); return; }

    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearInterval(watcher);
      resolve(ok);
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || data.type !== 'mcp-oauth') return;
      if (expectedState && data.state !== expectedState) return;
      finish(!!data.ok);
      try { popup.close(); } catch {}
    };
    window.addEventListener('message', onMessage);

    const watcher = setInterval(() => {
      if (popup.closed) finish(false);
    }, 500);
  });
}


export const StarIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export function formatStarCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatRelativeTime(iso: string, locale: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.floor(diff / day));
  if (days < 30) return locale === 'zh-CN' ? `${days} 天前` : `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return locale === 'zh-CN' ? `${months} 个月前` : `${months}mo ago`;
  const years = Math.floor(months / 12);
  return locale === 'zh-CN' ? `${years} 年前` : `${years}y ago`;
}

const CATEGORY_META: Record<string, { zh: string; en: string; order: number }> = {
  dev:           { zh: '开发工具',     en: 'Development',     order: 0 },
  productivity:  { zh: '生产力',       en: 'Productivity',    order: 1 },
  communication: { zh: '协作沟通',     en: 'Communication',   order: 2 },
  data:          { zh: '数据',         en: 'Data',            order: 3 },
  search:        { zh: '搜索',         en: 'Search',          order: 4 },
  utility:       { zh: '工具',         en: 'Utility',         order: 5 },
  custom:        { zh: '自定义',       en: 'Custom',          order: 6 },
};

export function groupByCategory(items: McpCatalogItem[]): Array<{ key: string; items: McpCatalogItem[] }> {
  const groups = new Map<string, McpCatalogItem[]>();
  for (const item of items) {
    const arr = groups.get(item.category) || [];
    arr.push(item);
    groups.set(item.category, arr);
  }
  return [...groups.entries()]
    .sort((a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99))
    .map(([key, items]) => ({ key, items }));
}


export function CategoryGroup({
  groupKey, locale, children,
}: {
  groupKey: string;
  locale: string;
  children: ReactNode;
}) {
  const meta = CATEGORY_META[groupKey];
  const label = meta ? L(locale, meta.zh, meta.en) : groupKey;
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-fg-5">{label}</div>
      {children}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-edge py-10 text-center">
      <div className="text-[13px] font-medium text-fg-3">{title}</div>
      {subtitle && <div className="mt-1 text-[12px] text-fg-5">{subtitle}</div>}
    </div>
  );
}

