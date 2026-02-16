import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Cpu,
  Activity,
  Zap,
  AlertTriangle,
  XCircle,
  Clock,
  Settings,
  RefreshCw,
  Sparkles,
  Target,
  Settings2,
  Gauge,
  ChevronDown,
  ChevronUp,
  Lock,
  Save,
  Server
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = 'http://localhost:3001/api';

interface CTOConfig {
  enabled: boolean;
  useAIForDecisions: boolean;
  ctoProvider: string;
  strategy?: 'aggressive' | 'balanced' | 'conservative';
  autonomyLevel?: 'full' | 'oversight';
  activeProviders?: string[];
  costBudgets?: {
    perTaskUsd?: number;
    perTeamDailyUsd?: number;
    perProjectWeeklyUsd?: number;
  };
  models?: {
    preferredModels: string[];
  };
  subscriptions: {
    claude: { plan: string };
    gemini: { plan: string };
    codex: { plan: string };
  };
  maxRetries: number;
  splitComplexityScore: number;
  deferWindowUsagePercent: number;
}

interface UsageSummary {
  hours: number;
  project_id?: string | null;
  team_id?: string | null;
  task_id?: string | null;
  provider?: string | null;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_provider: Record<string, { total_cost_usd: number; total_input_tokens: number; total_output_tokens: number }>;
  by_model: Record<string, { total_cost_usd: number; total_input_tokens: number; total_output_tokens: number }>;
  by_actor_type?: Record<string, { total_cost_usd: number; total_input_tokens: number; total_output_tokens: number }>;
}

interface TopTaskRow {
  task_id: string;
  title: string;
  status: string;
  project_name: string;
  team_name: string;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  last_used_at: string;
}

export function CTODashboard() {
  const [config, setConfig] = useState<CTOConfig>({
    enabled: true,
    useAIForDecisions: true,
    ctoProvider: 'gemini-3-pro-preview',
    strategy: 'balanced',
    autonomyLevel: 'full',
    activeProviders: ['claude', 'gemini', 'codex'],
    costBudgets: {
      perTaskUsd: 2.5,
      perTeamDailyUsd: 25,
      perProjectWeeklyUsd: 120
    },
    subscriptions: {
      claude: { plan: 'max5x' },
      gemini: { plan: 'ultra' },
      codex: { plan: 'plus' }
    },
    maxRetries: 2,
    splitComplexityScore: 45,
    deferWindowUsagePercent: 90
  });
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [usage24h, setUsage24h] = useState<UsageSummary | null>(null);
  const [usage7d, setUsage7d] = useState<UsageSummary | null>(null);
  const [topTasks, setTopTasks] = useState<TopTaskRow[]>([]);
  const [warningTasks, setWarningTasks] = useState<any[]>([]);
  const [usageFilters, setUsageFilters] = useState<{ teamId?: string; projectId?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [usageFilters.teamId, usageFilters.projectId]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch CTO config
      const configRes = await fetch(`${API_URL}/cto/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (configRes.ok) {
        const data = await configRes.json();
        if (!data.activeProviders && data.subscriptions) {
          data.activeProviders = Object.keys(data.subscriptions);
        }
        if (!data.strategy) data.strategy = 'balanced';
        if (!data.autonomyLevel) data.autonomyLevel = 'full';
        setConfig(data);
      }

      // Fetch Teams
      const teamsRes = await fetch(`${API_URL}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data);
      }

      // Fetch Projects
      const projectsRes = await fetch(`${API_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }

      // Fetch active tasks
      const tasksRes = await fetch(`${API_URL}/runner/active-tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setActiveTasks(data);
      }

      // Fetch warning tasks
      const allTasksRes = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (allTasksRes.ok) {
        const data = await allTasksRes.json();
        setAllTasks(data);
        const warnings = data.filter((t: any) => {
          if (!t.resource_metadata) return false;
          try {
            const meta = JSON.parse(t.resource_metadata);
            return Boolean(meta?.cto_warning);
          } catch {
            return false;
          }
        });
        setWarningTasks(warnings);
      }

      // Fetch usage summaries
      const teamParam = usageFilters.teamId ? `&team_id=${usageFilters.teamId}` : '';
      const projectParam = usageFilters.projectId ? `&project_id=${usageFilters.projectId}` : '';
      const usage24Res = await fetch(`${API_URL}/usage/summary?hours=24${teamParam}${projectParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usage24Res.ok) {
        const data = await usage24Res.json();
        setUsage24h(data);
      }
      const usage7Res = await fetch(`${API_URL}/usage/summary?hours=168${teamParam}${projectParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usage7Res.ok) {
        const data = await usage7Res.json();
        setUsage7d(data);
      }
      const topRes = await fetch(`${API_URL}/usage/top-tasks?hours=168&limit=5${teamParam}${projectParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (topRes.ok) {
        const data = await topRes.json();
        setTopTasks(data.rows || []);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: CTOConfig) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/cto/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });

      if (res.ok) {
        setConfig(newConfig);
        toast.success('Configuration saved successfully');
      }
    } catch (e) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateStrategy = (strategy: 'aggressive' | 'balanced' | 'conservative') => {
    const newConfig = { ...config, strategy };
    if (strategy === 'aggressive') {
      newConfig.maxRetries = 3;
      newConfig.deferWindowUsagePercent = 95;
    } else if (strategy === 'conservative') {
      newConfig.maxRetries = 1;
      newConfig.deferWindowUsagePercent = 80;
    } else {
      newConfig.maxRetries = 2;
      newConfig.deferWindowUsagePercent = 90;
    }
    saveConfig(newConfig);
  };

  const toggleProvider = (provider: string) => {
    const current = config.activeProviders || [];
    const newActive = current.includes(provider) 
      ? current.filter(p => p !== provider)
      : [...current, provider];
    saveConfig({ ...config, activeProviders: newActive });
  };

  const formatUsd = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `$${value.toFixed(2)}`;
  };

  const budgetStatusLine = (spent: number | null | undefined, budget: number | undefined) => {
    if (budget === undefined || budget === null) return { text: 'No budget set', pct: 0 };
    const safeSpent = spent || 0;
    const pct = Math.min(100, (safeSpent / budget) * 100);
    return { text: `${formatUsd(safeSpent)} / ${formatUsd(budget)}`, pct };
  };

  const decisionQueue = {
    blocked: allTasks.filter(t => (t.status || '').toLowerCase() === 'blocked'),
    review: allTasks.filter(t => (t.status || '').toLowerCase() === 'for review'),
    warnings: warningTasks
  };

  const queueCount = decisionQueue.blocked.length + decisionQueue.review.length + decisionQueue.warnings.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground font-medium">Initializing CTO Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">CTO War Room</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">Executive Command</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Live</span>
          </div>
        </div>

        {/* Executive Brief */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute -right-8 top-4 h-44 w-44 pointer-events-none opacity-70 -z-10">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9),rgba(255,255,255,0.15)_35%,rgba(20,184,166,0.25)_55%,rgba(15,23,42,0.9)_80%)] shadow-[0_25px_60px_rgba(0,0,0,0.45)] border border-teal-500/25" />
            <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-white/60 blur-sm" />
            <div className="absolute left-10 top-14 h-5 w-5 rounded-full bg-white/40 blur-[1px]" />
            <div className="absolute inset-x-6 bottom-4 h-6 rounded-full bg-black/40 blur-xl" />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-200/80">Executive Brief</p>
              <h2 className="text-2xl font-bold text-foreground">Company Situation Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase tracking-widest text-teal-200/80 mb-1">Yesterday</p>
                  <p>{usage24h?.total_cost_usd ? `Spent ${formatUsd(usage24h.total_cost_usd)} across teams.` : 'No spend recorded.'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-teal-200/80 mb-1">Today</p>
                  <p>{activeTasks.length} active tasks in motion.</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-teal-200/80 mb-1">Tomorrow</p>
                  <p>{queueCount} decisions pending CEO attention.</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Decision Queue</p>
                <p className="text-2xl font-bold text-foreground">{queueCount}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Risk Alerts</p>
                <p className="text-2xl font-bold text-foreground">{warningTasks.length}</p>
              </div>
              <button className="w-full rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-200 py-2.5 text-sm font-bold hover:bg-teal-500/30 transition">
                Review Decision Queue
              </button>
            </div>
          </div>
        </div>

        {/* Decision Queue */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
              Decision Queue
            </h3>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{queueCount} pending</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(['blocked', 'review', 'warnings'] as const).map((bucket) => {
              const items = decisionQueue[bucket];
              const label = bucket === 'blocked' ? 'Blocked' : bucket === 'review' ? 'For Review' : 'Warnings';
              return (
                <div key={bucket} className="rounded-2xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{label}</p>
                  <div className="space-y-3">
                    {items.length > 0 ? items.slice(0, 4).map((t: any) => (
                      <div key={t.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                        <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.project_name || 'No project'} • {t.team_name || 'No team'}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button className="px-2.5 py-1 rounded-md border border-border text-xs font-bold">Approve</button>
                          <button className="px-2.5 py-1 rounded-md border border-border text-xs font-bold">Clarify</button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No items.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Governance & Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Decision Governance */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="relative z-10">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Settings2 className="w-6 h-6 text-primary" />
                Decision Governance
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Operating Posture */}
                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Operating Posture
                  </label>
                  <div className="flex p-1.5 bg-secondary/30 rounded-xl border border-border">
                    {['aggressive', 'balanced', 'conservative'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateStrategy(mode as any)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                          config.strategy === mode 
                            ? 'bg-background text-foreground shadow-md border border-border/50' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {config.strategy === 'aggressive' && "Maximize velocity. Higher spend, more parallel execution."}
                    {config.strategy === 'balanced' && "Balance speed, spend, and quality."}
                    {config.strategy === 'conservative' && "Conserve spend. Sequential delivery and tighter limits."}
                  </p>
                </div>

                {/* Autonomy Level */}
                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-500" />
                    Decision Autonomy
                  </label>
                  <div className="flex p-1.5 bg-secondary/30 rounded-xl border border-border">
                    <button
                      onClick={() => saveConfig({ ...config, autonomyLevel: 'full' })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        config.autonomyLevel === 'full' 
                          ? 'bg-background text-foreground shadow-md border border-border/50' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                    >
                      Full Autonomy
                    </button>
                    <button
                      onClick={() => saveConfig({ ...config, autonomyLevel: 'oversight' })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        config.autonomyLevel === 'oversight' 
                          ? 'bg-background text-foreground shadow-md border border-border/50' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                    >
                      Human Oversight
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {config.autonomyLevel === 'full' ? "CTO executes decisions independently." : "CTO requests approval for high-impact changes."}
                  </p>
                </div>
              </div>

              {/* Decision Partner */}
              <div className="pt-8 border-t border-border space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    Decision Partner
                  </label>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase">Executive Reasoning</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Provider Choice */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Decision Partner</span>
                    <div className="flex p-1 bg-secondary/20 rounded-lg border border-border/50">
                      {['claude', 'gemini', 'openai'].map(p => (
                        <button
                          key={p}
                          onClick={() => {
                            const newModel = p === 'claude'
                              ? 'claude-opus-4-5-20251101'
                              : p === 'openai'
                                ? 'gpt-5.2-pro'
                                : 'gemini-3-pro-preview';
                            saveConfig({ ...config, ctoProvider: newModel });
                          }}
                          className={`flex-1 py-2 rounded-md text-xs font-bold capitalize transition-all ${
                            (config.ctoProvider.includes(p))
                              ? 'bg-background text-foreground shadow-sm border border-border/50'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Model (Fixed by Provider) */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Capability Tier (Fixed)</span>
                    <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground">
                      {config.ctoProvider.includes('claude') && 'Claude Opus 4.5'}
                      {config.ctoProvider.includes('gpt') && 'OpenAI GPT‑5.2 Pro'}
                      {config.ctoProvider.includes('gemini') && 'Gemini 3 Pro Preview'}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Model is fixed by governance policy.</p>
                  </div>
                </div>
              </div>
              </div>
            </motion.div>

            {/* Decision Partners section removed for now */}

            {/* Operating Mode section removed */}

            {/* Live Activity (Moved to Main Column) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-primary" />
                  Live Activity
                </h3>
                
                {activeTasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeTasks.map((task) => (
                      <div key={task.id} className="p-4 rounded-xl bg-secondary/30 border border-border flex items-center justify-between group hover:border-primary/50 transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold text-base text-foreground truncate">{task.title}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Project: {task.project_name || 'General'}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          <span className="text-xs font-black uppercase tracking-tighter text-primary">Live</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground bg-secondary/5 rounded-2xl border border-dashed border-border flex items-center justify-center gap-4">
                    <Clock className="w-6 h-6 opacity-30" />
                    <div>
                      <p className="text-sm font-bold text-foreground/70">CTO Standing By</p>
                      <p className="text-[10px] opacity-70">Awaiting task orchestration...</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

          </div>

          {/* Right Column: Status & Monitoring */}
          <div className="space-y-6">

            {/* Capital & Allocation */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 h-fit shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                  <Gauge className="w-6 h-6 text-primary" />
                  Capital & Allocation
                </h3>
                <button
                  onClick={fetchDashboardData}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary/60 hover:bg-secondary text-foreground border border-border"
                >
                  Refresh
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Includes CTO + Team Lead activity across teams and projects</p>

              <div className="grid grid-cols-1 gap-3 mb-6">
                <select
                  className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm"
                  value={usageFilters.projectId || ''}
                  onChange={(e) => setUsageFilters((prev) => ({ ...prev, projectId: e.target.value || undefined }))}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm"
                  value={usageFilters.teamId || ''}
                  onChange={(e) => setUsageFilters((prev) => ({ ...prev, teamId: e.target.value || undefined }))}
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Allocation Health</p>
                  <div className="space-y-3">
                    {(() => {
                      const line = budgetStatusLine(usage24h?.total_cost_usd, config.costBudgets?.perTeamDailyUsd);
                      return (
                        <div>
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>Team (24h burn)</span>
                            <span>{line.text}</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary/60 mt-2 overflow-hidden">
                            <div className={`h-full ${line.pct > 100 ? 'bg-red-500' : line.pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, line.pct)}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const line = budgetStatusLine(usage7d?.total_cost_usd, config.costBudgets?.perProjectWeeklyUsd);
                      return (
                        <div>
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>Project (7d burn)</span>
                            <span>{line.text}</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary/60 mt-2 overflow-hidden">
                            <div className={`h-full ${line.pct > 100 ? 'bg-red-500' : line.pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, line.pct)}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                    <div className="text-xs text-muted-foreground">
                      Task allocation: {formatUsd(config.costBudgets?.perTaskUsd)} per task
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Burn Totals</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Last 24h</p>
                      <p className="text-lg font-bold">{formatUsd(usage24h?.total_cost_usd || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{usage24h?.total_input_tokens || 0} in / {usage24h?.total_output_tokens || 0} out</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground">Last 7d</p>
                      <p className="text-lg font-bold">{formatUsd(usage7d?.total_cost_usd || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{usage7d?.total_input_tokens || 0} in / {usage7d?.total_output_tokens || 0} out</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Provider Breakdown (7d)</p>
                  <div className="space-y-2">
                    {usage7d && Object.keys(usage7d.by_provider || {}).length > 0 ? (
                      Object.entries(usage7d.by_provider).map(([provider, data]) => (
                        <div key={provider} className="flex items-center justify-between text-sm font-semibold">
                          <span className="capitalize">{provider}</span>
                          <span>{formatUsd(data.total_cost_usd)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No usage recorded.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">CTO vs Team Leads (7d)</p>
                  <div className="space-y-2">
                    {usage7d && usage7d.by_actor_type && Object.keys(usage7d.by_actor_type).length > 0 ? (
                      Object.entries(usage7d.by_actor_type).map(([actor, data]) => (
                        <div key={actor} className="flex items-center justify-between text-sm font-semibold">
                          <span className="capitalize">{actor.replace('_', ' ')}</span>
                          <span>{formatUsd(data.total_cost_usd)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No actor usage recorded.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">High-Cost Tasks (7d)</p>
                  <div className="space-y-2">
                    {topTasks.length > 0 ? (
                      topTasks.map((t) => (
                        <div key={t.task_id} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{t.title || 'Untitled Task'}</p>
                            <p className="text-[10px] text-muted-foreground">{t.project_name || 'No project'} • {t.team_name || 'No team'}</p>
                          </div>
                          <span className="text-xs font-bold">{formatUsd(t.total_cost_usd)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No task usage data yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-secondary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Warning Feed</p>
                  <div className="space-y-2">
                    {warningTasks.length > 0 ? (
                      warningTasks.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{t.title}</p>
                            <p className="text-[10px] text-muted-foreground">{t.status}</p>
                          </div>
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No warnings.</p>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </motion.div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
