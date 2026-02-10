import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Brain, Cpu, Zap, Settings2, RefreshCw, Activity, 
  CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Target, Shield, Gauge, ChevronDown, ChevronUp, Lock
} from 'lucide-react';

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

const DEFAULT_CONFIG: CTOConfig = {
  enabled: true,
  useAIForDecisions: true,
  ctoProvider: 'gemini-3-pro',
  strategy: 'balanced',
  autonomyLevel: 'full',
  activeProviders: ['claude', 'gemini', 'codex'],
  models: {
    preferredModels: ['gemini-3-pro', 'claude-opus-4.5', 'gpt-5.2', 'claude-sonnet-4.5', 'gemini-2.0-flash']
  },
  subscriptions: {
    claude: { plan: 'max5x' },
    gemini: { plan: 'ultra' },
    codex: { plan: 'plus' }
  },
  maxRetries: 2,
  splitComplexityScore: 45,
  deferWindowUsagePercent: 90
};

interface CTOMetrics {
  activeTasks: number;
  totalDecisions: number;
  aiDecisions: number;
  successRate: number;
  avgComplexity: string;
  resourceUsage: {
    claude: { remaining5h: number; remainingDay: number };
    gemini: { remaining5h: number; remainingDay: number };
  };
}

export function CTOSettings() {
  const [config, setConfig] = useState<CTOConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<CTOMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchCTOSettings();
  }, []);

  const fetchCTOSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/cto/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Infer active providers if not present (backward compatibility)
        if (!data.activeProviders && data.subscriptions) {
          data.activeProviders = Object.entries(data.subscriptions)
            .filter(([_, sub]: [string, any]) => sub.plan !== 'none')
            .map(([provider]) => provider);
        }
        
        setConfig({ ...DEFAULT_CONFIG, ...data });
      }
    } catch (e) {
      console.error('Failed to fetch CTO settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveCTOSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/cto/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        toast.success('CTO settings saved successfully! Restart agent-runner to apply changes.');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      toast.error('Failed to save CTO settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = (provider: string) => {
    setConfig(prev => {
      const current = prev.activeProviders || [];
      const newActive = current.includes(provider) 
        ? current.filter(p => p !== provider)
        : [...current, provider];
      
      return { ...prev, activeProviders: newActive };
    });
  };

  const fetchCTOMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/runner/active-tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const tasks = await res.json();
        // Mock metrics for now - will be replaced with real CTO API
        setMetrics({
          activeTasks: tasks.length,
          totalDecisions: 0,
          aiDecisions: 0,
          successRate: 0,
          avgComplexity: 'N/A',
          resourceUsage: {
            claude: { remaining5h: 225, remainingDay: 1080 },
            gemini: { remaining5h: 0, remainingDay: 500 }
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch CTO metrics:', e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 border border-border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-secondary rounded w-1/3"></div>
          <div className="h-4 bg-secondary rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="glass-card p-6 border border-border text-center">
        <p className="text-muted-foreground mb-4">Failed to load configuration.</p>
        <button 
          onClick={fetchCTOSettings}
          className="text-sm text-primary hover:underline flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 border border-border space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">CTO Intelligence Layer</h3>
            <p className="text-sm text-muted-foreground">Always active AI-powered orchestration</p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          AI MODE ACTIVE
        </div>
      </div>

      <>
        {/* CEO Controls Section (Human Centric) */}
          <div className="space-y-4 p-5 rounded-xl border border-primary/20 bg-primary/5">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              CEO Controls
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Strategic Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Strategic Mode
                </label>
                <div className="flex gap-2">
                  {['aggressive', 'balanced', 'conservative'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setConfig(prev => ({ ...prev, strategy: mode as any }))}
                      className={`flex-1 px-3 py-2 rounded-md text-xs font-medium capitalize border transition-all ${
                        config.strategy === mode 
                          ? 'bg-blue-500 text-white border-blue-600 shadow-sm' 
                          : 'bg-background hover:bg-secondary border-border text-muted-foreground'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground h-4">
                  {config.strategy === 'aggressive' && "Maximize velocity. Higher costs, more retries."}
                  {config.strategy === 'balanced' && "Optimal balance of speed and cost efficiency."}
                  {config.strategy === 'conservative' && "Minimize costs. Strict limits, fewer retries."}
                </p>
              </div>

              {/* Autonomy Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-500" />
                  Autonomy Level
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, autonomyLevel: 'full' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                      config.autonomyLevel === 'full' 
                        ? 'bg-purple-500 text-white border-purple-600 shadow-sm' 
                        : 'bg-background hover:bg-secondary border-border text-muted-foreground'
                    }`}
                  >
                    Full Autonomy
                  </button>
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, autonomyLevel: 'oversight' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                      config.autonomyLevel === 'oversight' 
                        ? 'bg-purple-500 text-white border-purple-600 shadow-sm' 
                        : 'bg-background hover:bg-secondary border-border text-muted-foreground'
                    }`}
                  >
                    Human Oversight
                  </button>
                </div>
                <p className="text-xs text-muted-foreground h-4">
                  {config.autonomyLevel === 'full' ? "CTO acts independently on all tasks." : "CTO requests approval for critical actions."}
                </p>
              </div>
            </div>

            {/* Active Subscriptions (Simple Toggle) */}
            <div className="space-y-2 mt-4 pt-4 border-t border-primary/10">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Active Subscriptions
              </label>
              <p className="text-xs text-muted-foreground mb-2">Which AI providers do you have subscriptions for?</p>
              
              <div className="flex gap-3">
                {['claude', 'gemini', 'codex'].map(provider => {
                  const isActive = config.activeProviders?.includes(provider);
                  return (
                    <button
                      key={provider}
                      onClick={() => toggleProvider(provider)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-secondary/80 border-primary/30 text-foreground'
                          : 'bg-background border-border text-muted-foreground opacity-60'
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4" />}
                      <span className="capitalize">{provider}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Advanced Settings (Collapsible) */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="w-4 h-4 text-muted-foreground" />
                Advanced Technical Config
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-6 bg-secondary/10">
                {/* AI Decision Mode */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">AI-Powered Decisions</label>
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, useAIForDecisions: !prev.useAIForDecisions }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        config.useAIForDecisions ? 'bg-primary' : 'bg-secondary'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${config.useAIForDecisions ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                {/* CTO AI Model */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">CTO Model</label>
                  <select
                    value={config.ctoProvider}
                    onChange={(e) => setConfig(prev => ({ ...prev, ctoProvider: e.target.value }))}
                    disabled={!config.useAIForDecisions}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <optgroup label="Primary Models">
                      <option value="gemini-3-pro">Gemini 3 Pro</option>
                      <option value="claude-opus-4.5">Claude Opus 4.5</option>
                      <option value="gpt-5.2">GPT-5.2</option>
                    </optgroup>
                    <optgroup label="Fast Models">
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                    </optgroup>
                  </select>
                </div>

                {/* Subscription Plans Details */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Subscription Tiers</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['claude', 'gemini', 'codex'].map(provider => (
                      <div key={provider} className={`space-y-1 ${!config.activeProviders?.includes(provider) ? 'opacity-40 pointer-events-none' : ''}`}>
                        <label className="text-xs font-medium text-muted-foreground uppercase">{provider}</label>
                        <select
                          value={config.subscriptions[provider as keyof typeof config.subscriptions]?.plan || 'pro'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            subscriptions: { 
                              ...prev.subscriptions, 
                              [provider]: { plan: e.target.value } 
                            }
                          }))}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        >
                          <option value="pro">Pro</option>
                          <option value="max5x">Max 5x / Ultra</option>
                          <option value="max20x">Max 20x</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Thresholds */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Technical Thresholds</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Split Score</label>
                      <input
                        type="number"
                        value={config.splitComplexityScore}
                        onChange={(e) => setConfig(prev => ({ ...prev, splitComplexityScore: parseInt(e.target.value) }))}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Defer %</label>
                      <input
                        type="number"
                        value={config.deferWindowUsagePercent}
                        onChange={(e) => setConfig(prev => ({ ...prev, deferWindowUsagePercent: parseInt(e.target.value) }))}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Retries</label>
                      <input
                        type="number"
                        value={config.maxRetries}
                        onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTO Performance Dashboard */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                CTO Performance Dashboard
              </label>
              <button
                onClick={fetchCTOMetrics}
                disabled={loadingMetrics}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingMetrics ? 'animate-spin' : ''}`} />
                {loadingMetrics ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {metrics ? (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Active</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{metrics.activeTasks}</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Success</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{metrics.successRate}%</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-muted-foreground">AI Decisions</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{metrics.aiDecisions}</p>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    <span className="text-xs font-medium text-muted-foreground">Complexity</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{metrics.avgComplexity}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Click refresh to load CTO performance metrics
              </div>
            )}

            {/* View Decision Logs */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Decision logs: <code className="px-1 py-0.5 rounded bg-secondary">agent-runner/cto/decisions/DECISION_LOG.md</code></span>
            </div>
          </div>
        </>

      {/* Save Button */}
      <div className="flex justify-end pt-2 border-t border-border">
        <button
          onClick={saveCTOSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save CTO Settings'}
        </button>
      </div>
    </div>
  );
}
