import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../store';
import { cn } from '../../utils';
import { TabsList, TabsTrigger } from '../../components/ui';
import { L } from './shared';
import { McpCatalogSection } from './McpSection';
import { SkillsCatalogSection } from './SkillsSection';
import { CliCatalogSection } from './CliSection';

// Extensions page shell: tab nav plus the two exported entry points. The MCP / Skills / CLI
// bodies live in their own modules — this file was 2.8k lines with all three inlined.

type ExtensionTab = 'mcp' | 'cli' | 'skill';

function ExtensionTabNav({
  active,
  onChange,
  locale,
  counts,
}: {
  active: ExtensionTab;
  onChange: (tab: ExtensionTab) => void;
  locale: string;
  counts?: Partial<Record<ExtensionTab, number>>;
}) {
  const tabs: Array<{
    id: ExtensionTab;
    icon: ReactNode;
    labelZh: string;
    labelEn: string;
  }> = [
    {
      id: 'mcp',
      labelZh: 'MCP 服务',
      labelEn: 'MCP',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><circle cx="4" cy="5" r="1.6" /><circle cx="20" cy="5" r="1.6" /><circle cx="4" cy="19" r="1.6" /><circle cx="20" cy="19" r="1.6" />
          <path d="M6 6 l4 4 M18 6 l-4 4 M6 18 l4 -4 M18 18 l-4 -4" />
        </svg>
      ),
    },
    {
      id: 'cli',
      labelZh: '命令行',
      labelEn: 'CLI',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17 l5 -5 -5 -5" /><path d="M12 19 h8" />
        </svg>
      ),
    },
    {
      id: 'skill',
      labelZh: '技能包',
      labelEn: 'Skills',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 l3 7 h7 l-5.5 4.5 2 7.5 L12 17 l-6.5 4 2 -7.5 L2 9 h7 z" />
        </svg>
      ),
    },
  ];

  return (
    <TabsList className="w-fit bg-panel/80 backdrop-blur">
      {tabs.map(t => (
        <TabsTrigger
          key={t.id}
          active={active === t.id}
          onClick={() => onChange(t.id)}
          className="gap-1.5 px-3.5"
        >
          <span className="shrink-0">{t.icon}</span>
          <span>{locale === 'zh-CN' ? t.labelZh : t.labelEn}</span>
          {counts?.[t.id] !== undefined && (
            <span className={cn(
              'ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
              active === t.id ? 'bg-primary/12 text-primary' : 'bg-inset/70 text-fg-5',
            )}>
              {counts[t.id]}
            </span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function ExtensionsTab({
  onOpenBrowserSetup,
}: {
  onOpenBrowserSetup?: () => void;
}) {
  const locale = useStore(s => s.locale);
  const state = useStore(s => s.state);
  const workdir = state?.config?.workdir || '';
  const [tab, setTab] = useState<ExtensionTab>(() => {
    try {
      const saved = localStorage.getItem('pikiloom:extensions:tab');
      return (saved === 'mcp' || saved === 'cli' || saved === 'skill') ? saved : 'mcp';
    } catch { return 'mcp'; }
  });
  const switchTab = useCallback((next: ExtensionTab) => {
    setTab(next);
    try { localStorage.setItem('pikiloom:extensions:tab', next); } catch {  }
  }, []);

  return (
    <div className="animate-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[13px] leading-relaxed text-fg-4">
            {L(locale,
              '管理一次授权即可全局复用的服务与工具。项目专属的扩展请在工作台侧栏配置。',
              'One-time authorization, use everywhere. Project-specific extensions live in the Workbench sidebar.',
            )}
          </div>
        </div>
        <ExtensionTabNav active={tab} onChange={switchTab} locale={locale} />
      </div>

      <div key={tab} className="animate-in-fade">
        {tab === 'mcp' && (
          <div className="space-y-7">
            <McpCatalogSection scope="global" workdir={workdir} locale={locale} onOpenBrowserSetup={onOpenBrowserSetup} />
          </div>
        )}
        {tab === 'cli' && <CliCatalogSection locale={locale} scope="global" />}
        {tab === 'skill' && <SkillsCatalogSection scope="global" workdir={workdir} locale={locale} />}
      </div>
    </div>
  );
}

export function WorkspaceExtensionsBody({ workdir }: { workdir: string }) {
  const locale = useStore(s => s.locale);
  const [tab, setTab] = useState<ExtensionTab>(() => {
    try {
      const saved = localStorage.getItem('pikiloom:extensions-ws:tab');
      return (saved === 'mcp' || saved === 'cli' || saved === 'skill') ? saved : 'mcp';
    } catch { return 'mcp'; }
  });
  const switchTab = useCallback((next: ExtensionTab) => {
    setTab(next);
    try { localStorage.setItem('pikiloom:extensions-ws:tab', next); } catch {  }
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-[13px] leading-relaxed text-fg-4">
          {L(locale,
            '仅对当前工作区生效 — 依赖项目目录的本地服务和专属技能包。',
            'Scoped to this workspace — local services that depend on project context and project-specific skill packs.',
          )}
        </div>
        <ExtensionTabNav active={tab} onChange={switchTab} locale={locale} />
      </div>
      <div key={tab} className="animate-in-fade">
        {tab === 'mcp' && <McpCatalogSection scope="workspace" workdir={workdir} locale={locale} />}
        {tab === 'cli' && <CliCatalogSection locale={locale} scope="workspace" />}
        {tab === 'skill' && <SkillsCatalogSection scope="workspace" workdir={workdir} locale={locale} />}
      </div>
    </div>
  );
}
