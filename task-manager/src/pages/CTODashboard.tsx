import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Cpu,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  RefreshCw,
  Sparkles,
  Target,
  Shield,
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

interface ResourceStatus {
  claude: { remaining5h: number; remainingDay: number; available: boolean; source?: string };
  gemini: { remaining5h: number; remainingDay: number; available: boolean; source?: string };
  codex: { remaining5h: number; remainingDay: number; available: boolean; source?: string };
}

export function CTODashboard() {
  const [config, setConfig] = useState<CTOConfig>({
    enabled: true,
    useAIForDecisions: true,
    ctoProvider: 'gemini-3-pro',
    strategy: 'balanced',
    autonomyLevel: 'full',
    activeProviders: ['claude', 'gemini', 'codex'],
    subscriptions: {
      claude: { plan: 'max5x' },
      gemini: { plan: 'ultra' },
      codex: { plan: 'plus' }
    },
    maxRetries: 2,
    splitComplexityScore: 45,
    deferWindowUsagePercent: 90
  });
  const [resources, setResources] = useState<ResourceStatus | null>(null);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

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

      // Fetch active tasks
      const tasksRes = await fetch(`${API_URL}/runner/active-tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setActiveTasks(data);
      }

      // Fetch real resource status from server
      const resourceRes = await fetch(`${API_URL}/cto/resource-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resourceRes.ok) {
        const data = await resourceRes.json();
        if (data && Object.keys(data).length > 0) {
          setResources(data);
        } else {
          setResources(null);
        }
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

  const getResourceHealth = (provider: keyof ResourceStatus) => {
    if (!resources) return 'unknown';
    if (!config.activeProviders?.includes(provider)) return 'disabled';

    const res = (resources as any)[provider];
    if (!res) return 'unknown';

    const plans: any = {
      claude: { pro: 45, max5x: 225, max20x: 900 },
      gemini: { pro: 100, ultra: 500 },
      codex: { plus: 90, pro: 900 }
    };
    const planName = config.subscriptions[provider as keyof typeof config.subscriptions]?.plan || 'pro';
    const max = plans[provider]?.[planName] || 100;

    const usage = res.remaining5h > 0 ? ((1 - (res.remaining5h / max)) * 100) : 100;
    if (usage > 90) return 'critical';
    if (usage > 70) return 'warning';
    return 'healthy';
  };

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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">CTO</h1>
          </div>
          
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Configuration & Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Behavior & Strategy Section */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 border border-border shadow-sm">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Settings2 className="w-6 h-6 text-primary" />
                Behavior & Strategy
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Strategic Mode */}
                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Strategic Mode
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
                    {config.strategy === 'aggressive' && "Maximize velocity. Higher API costs, more parallel tasks."}
                    {config.strategy === 'balanced' && "Optimal balance of speed, cost, and quality."}
                    {config.strategy === 'conservative' && "Minimize costs. Strict rate limits, sequential processing."}
                  </p>
                </div>

                {/* Autonomy Level */}
                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-5 h-5 text-purple-500" />
                    Autonomy Level
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
                    {config.autonomyLevel === 'full' ? "CTO makes and executes decisions independently." : "CTO requests approval for critical architectural changes."}
                  </p>
                </div>
              </div>

              {/* CTO Brain Configuration (Explicit Model Selection) */}
              <div className="pt-8 border-t border-border space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    CTO Brain Configuration
                  </label>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase">Reasoning Engine</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Provider Choice */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Decision Provider</span>
                    <div className="flex p-1 bg-secondary/20 rounded-lg border border-border/50">
                      {['claude', 'gemini'].map(p => (
                        <button
                          key={p}
                          onClick={() => {
                            const newModel = p === 'claude' ? 'claude-opus-4.5' : 'gemini-3-pro';
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

                  {/* Explicit Model Selection */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Reasoning Model</span>
                    <select
                      value={config.ctoProvider}
                      onChange={(e) => saveConfig({ ...config, ctoProvider: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground focus:ring-2 ring-primary/20 outline-none cursor-pointer"
                    >
                      {config.ctoProvider.includes('claude') ? (
                        <>
                          <option value="claude-opus-4.6">Claude Opus 4.6 (Max Intelligence)</option>
                          <option value="claude-sonnet-4.5">Claude Sonnet 4.5 (Optimal Balance)</option>
                        </>
                      ) : (
                        <>
                          <option value="gemini-3-pro">Gemini 3 Pro (Vision & Logic)</option>
                          <option value="gemini-3-flash">Gemini 3 Flash (Speed Optimized)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Provider & Resources Section */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 border border-border shadow-sm">
              <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-3">
                <Server className="w-6 h-6 text-primary" />
                Active Subscriptions
              </h3>
              <p className="text-base text-muted-foreground mb-6">
                Enable only the providers you have active subscriptions for.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['claude', 'gemini', 'codex'].map(provider => {
                  const isActive = config.activeProviders?.includes(provider);
                  return (
                    <div 
                      key={provider}
                      className={`p-6 rounded-2xl border transition-all ${
                        isActive 
                          ? 'bg-secondary/20 border-primary/30 shadow-sm' 
                          : 'bg-secondary/5 border-border opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-400'}`} />
                          <span className="text-lg font-bold capitalize text-foreground">{provider}</span>
                        </div>
                        <button
                          onClick={() => toggleProvider(provider)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isActive ? 'bg-primary' : 'bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      
                      {isActive && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plan Tier</label>
                          <select
                            value={config.subscriptions[provider as keyof typeof config.subscriptions]?.plan || 'pro'}
                            onChange={(e) => saveConfig({
                              ...config,
                              subscriptions: { 
                                ...config.subscriptions, 
                                [provider]: { plan: e.target.value } 
                              }
                            })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium focus:ring-2 ring-primary/20 outline-none cursor-pointer"
                          >
                            <option value="pro">Pro / Standard</option>
                            <option value="max5x">Max 5x / Ultra</option>
                            <option value="max20x">Max 20x / Enterprise</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Operational Style (Formerly Advanced Settings) */}
            <div className="border border-border rounded-2xl overflow-hidden bg-background/50 shadow-sm">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3 text-base font-bold text-muted-foreground">
                  <Gauge className="w-5 h-5" />
                  Operational Style
                </div>
                {showAdvanced ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ height: 0 }} 
                    animate={{ height: 'auto' }} 
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-8 border-t border-border bg-secondary/10 space-y-8">
                       
                       {/* Persistence Slider */}
                       <div className="space-y-3">
                          <div className="flex justify-between">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-500" /> Persistence
                            </label>
                            <span className="text-xs font-bold text-muted-foreground uppercase">
                              {config.maxRetries <= 1 ? "Low (Give up easily)" : config.maxRetries === 2 ? "Medium (Try a few times)" : "High (Relentless)"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="3"
                            step="1"
                            value={config.maxRetries}
                            onChange={(e) => saveConfig({ ...config, maxRetries: parseInt(e.target.value) })}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        {/* Delegation Threshold Slider */}
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Target className="w-4 h-4 text-blue-500" /> Delegation Threshold
                            </label>
                            <span className="text-xs font-bold text-muted-foreground uppercase">
                              {config.splitComplexityScore > 60 ? "Hands-on (Do it yourself)" : config.splitComplexityScore > 30 ? "Collaborative (Split complex tasks)" : "Managerial (Delegate everything)"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="90"
                            step="10"
                            value={config.splitComplexityScore}
                            onChange={(e) => saveConfig({ ...config, splitComplexityScore: parseInt(e.target.value) })}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        {/* Patience Slider */}
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Clock className="w-4 h-4 text-green-500" /> Patience (Wait for Resources)
                            </label>
                            <span className="text-xs font-bold text-muted-foreground uppercase">
                              {config.deferWindowUsagePercent > 90 ? "Urgent (Push limits)" : config.deferWindowUsagePercent > 70 ? "Flexible (Wait for windows)" : "Patient (Strict budget)"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="99"
                            step="5"
                            value={config.deferWindowUsagePercent}
                            onChange={(e) => saveConfig({ ...config, deferWindowUsagePercent: parseInt(e.target.value) })}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-green-500"
                          />
                        </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Live Activity (Moved to Main Column) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 border border-border shadow-sm">
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
            </motion.div>

          </div>

          {/* Right Column: Status & Monitoring */}
          <div className="space-y-6">
            
            {/* Resource Health Card */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 border border-border h-fit shadow-sm">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6 text-primary" />
                Resource Health
              </h3>
              
              <div className="space-y-6">
                {resources ? (
                  Object.entries(resources).map(([provider, status]) => {
                    const health = getResourceHealth(provider as keyof ResourceStatus);
                    if (health === 'disabled') return null;

                    const plans: any = {
                      claude: { pro: 45, max5x: 225, max20x: 900 },
                      gemini: { pro: 100, ultra: 500 },
                      codex: { plus: 90, pro: 900 }
                    };
                    const planName = config.subscriptions[provider as keyof typeof config.subscriptions]?.plan || 'pro';
                    const max = plans[provider]?.[planName] || 100;

                                                          return (

                                                            <div key={provider} className="space-y-3">

                                                              <div className="flex justify-between items-end">

                                                                <div className="flex flex-col">
                                                                  <span className="capitalize font-bold text-base">{provider}</span>
                                                                  {!status.available && status.reason && (
                                                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${status.needsAuth ? 'text-orange-500' : 'text-destructive'}`}>
                                                                      {status.reason}
                                                                    </span>
                                                                  )}
                                                                </div>

                                                                                                  <div className="flex items-center gap-2">
                                    {status.needsAuth ? (
                                      <button
                                        onClick={async () => {
                                          try {
                                            const token = localStorage.getItem('token');
                                            await fetch(`${API_URL}/runner/open-terminal`, {
                                              method: 'POST',
                                              headers: { 
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                              },
                                              body: JSON.stringify({ command: provider })
                                            });
                                            toast.success(`Opening terminal for ${provider} login...`);
                                          } catch (e) {
                                            toast.error('Failed to trigger terminal');
                                          }
                                        }}
                                        className="px-4 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-xs font-bold border border-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                                      >
                                        Enable
                                      </button>
                                    ) : (
                                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                        !status.available ? 'bg-destructive/10 text-destructive' :
                                        health === 'healthy' ? 'bg-green-500/10 text-green-500' :
                                        health === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                                        'bg-red-500/10 text-red-500'
                                      }`}>
                                        {!status.available ? 'Restricted' : `${Math.round((1 - (status.remaining5h / max)) * 100)}% Used`}
                                      </span>
                                    )}
                                  </div>

                                                                                                </div>

                                                                                                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">

                                                                                                  <div 

                                                                                                    className={`h-full rounded-full transition-all duration-500 ${

                                                                                                      status.needsAuth ? 'bg-orange-500' :

                                                                                                      !status.available ? 'bg-destructive' :

                                                                                                      health === 'healthy' ? 'bg-green-500' :

                                                                                                      health === 'warning' ? 'bg-yellow-500' : 'bg-red-500'

                                                                                                    }`}

                                                                                                    style={{ width: `${(status.needsAuth || !status.available) ? 100 : Math.min(100, (1 - (status.remaining5h / max)) * 100)}%` }}

                                                                                                  />

                                                                                                </div>

                                                            </div>

                                                          );                  })
                ) : (
                  <div className="text-center py-10 text-muted-foreground bg-secondary/10 rounded-2xl border border-dashed border-border">
                    <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-base font-bold text-foreground/70">Waiting for Runner...</p>
                    <p className="text-xs mt-1 opacity-70">Status not reported yet</p>
                  </div>
                )}
                
                {resources && (!config.activeProviders || config.activeProviders.length === 0) && (
                   <p className="text-sm text-yellow-500 font-bold italic text-center py-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                     No active providers configured.
                   </p>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
