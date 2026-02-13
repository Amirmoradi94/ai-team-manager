import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  Search, 
  DownloadCloud, 
  Settings2, 
  ShieldCheck, 
  Box, 
  Globe, 
  Database,
  Terminal,
  MessageSquare,
  Key,
  Shield,
  Zap,
  CheckCircle2,
  X,
  Cpu,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = 'http://localhost:3001/api';

interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'mcp' | 'api' | 'script';
  command?: string;
  config_schema?: string;
  icon?: string;
}

interface Employee {
  id: string;
  name: string;
  description: string;
}

export function ArsenalPage() {
  const [activeTab, setActiveTab] = useState<'market' | 'inventory' | 'allocation'>('market');
  const [deployedTools, setDeployedTools] = useState<Tool[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Acquisition Modal State
  const [isAcquireModalOpen, setIsAcquireModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchArsenalData();
  }, []);

  const fetchArsenalData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [toolsRes, specsRes] = await Promise.all([
        fetch(`${API_URL}/tools`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/employees`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (toolsRes.ok) setDeployedTools(await toolsRes.ok ? await toolsRes.json() : []);
      if (specsRes.ok) setEmployees(await specsRes.ok ? await specsRes.json() : []);
    } catch (e) {
      toast.error('Failed to sync arsenal data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcquire = (tool: any) => {
    setSelectedTool(tool);
    // Prep credential fields based on tool type
    const creds: any = {};
    if (tool.name === 'Firecrawl' || tool.name === 'Zyte' || tool.name === 'Slack') {
      creds.api_key = '';
    }
    setCredentials(creds);
    setIsAcquireModalOpen(true);
  };

  const deployAsset = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/tools`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: selectedTool.name,
          description: selectedTool.description,
          type: selectedTool.type,
          command: selectedTool.command,
          config_schema: JSON.stringify(Object.keys(credentials)),
          icon: selectedTool.name.toLowerCase()
        })
      });

      if (res.ok) {
        toast.success(`${selectedTool.name} acquired and deployed to company inventory`);
        fetchArsenalData();
        setIsAcquireModalOpen(false);
      }
    } catch (e) {
      toast.error('Deployment failed');
    } finally {
      setProcessing(false);
    }
  };

  const equipEmployee = async (specId: string, toolId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/employees/${specId}/equip`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tool_id: toolId, config_values: '{}' })
      });

      if (res.ok) {
        toast.success('Personnel equipped with asset');
      }
    } catch (e) {
      toast.error('Allocation failed');
    }
  };

  const marketplaceTools = [
    // Growth & Intelligence
    { name: 'Firecrawl', type: 'mcp', description: 'Deep web scraping and data extraction for market intelligence.', command: 'npx @firecrawl/mcp-server' },
    { name: 'Zyte API', type: 'api', description: 'Advanced anti-bot bypassing for resilient scraping of complex directories.', command: 'pip install zyte-api' },
    { name: 'Tavily', type: 'mcp', description: 'AI-native search engine for gathering verified facts and research data.', command: 'npx @tavily/mcp-server' },
    { name: 'Hunter.io', type: 'api', description: 'Professional email discovery and domain verification engine.', command: 'npm install hunterio' },
    { name: 'Exa Search', type: 'mcp', description: 'Neural search engine for finding companies and leads based on semantic meaning.', command: 'npx @exa/mcp-server' },
    
    // Engineering
    { name: 'GitHub', type: 'mcp', description: 'Complete version control and engineering workflow management.', command: 'npx @github/mcp-server' },
    { name: 'Docker', type: 'mcp', description: 'Container management and isolated testing environments.', command: 'npx @docker/mcp-server' },
    { name: 'Supabase', type: 'mcp', description: 'Instant database, auth, and edge function orchestration.', command: 'npx @supabase/mcp-server' },
    { name: 'Sentry', type: 'mcp', description: 'Real-time error tracking and performance monitoring integration.', command: 'npx @sentry/mcp-server' },
    { name: 'Postgres', type: 'mcp', description: 'Direct SQL database query and schema management.', command: 'npx @postgres/mcp-server' },

    // Strategy & Comm
    { name: 'Linear', type: 'mcp', description: 'Professional issue tracking and project synchronization.', command: 'npx @linear/mcp-server' },
    { name: 'Notion', type: 'mcp', description: 'Access to company wikis, documentation, and SOPs.', command: 'npx @notion/mcp-server' },
    { name: 'Slack', type: 'mcp', description: 'Corporate communication and notification orchestration.', command: 'npx @slack/mcp-server' },
    { name: 'BigQuery', type: 'api', description: 'Deep data warehouse analysis and complex SQL reporting.', command: 'pip install google-cloud-bigquery' },

    // Content & Automation
    { name: 'Jina Reader', type: 'api', description: 'Clean content extraction from URLs for high-quality summarization.', command: 'npm install @jina-ai/reader' },
    { name: 'DeepL', type: 'api', description: 'Enterprise-grade neural translation for content localization.', command: 'npm install deepl-node' },
    { name: 'Google Sheets', type: 'mcp', description: 'Collaborative data management and lead-list reporting.', command: 'npx @google/mcp-sheets' },
    { name: 'Zapier', type: 'api', description: 'Workflow automation across 6,000+ business applications.', command: 'npm install zapier-platform-core' },
    { name: 'Puppeteer', type: 'mcp', description: 'Headless browser orchestration for complex web interactions.', command: 'npx @puppeteer/mcp-server' }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Executive Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-background/50 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            Company Arsenal
          </h2>
          <p className="text-sm text-muted-foreground mt-1 font-medium tracking-tight">
            Manage operational capabilities and assign high-value assets to your workforce.
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex p-1.5 bg-secondary/30 rounded-xl border border-border shadow-inner">
          {[
            { id: 'market', label: 'Acquire Capabilities' },
            { id: 'inventory', label: 'Deployed Assets' },
            { id: 'allocation', label: 'Resource Allocation' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-background text-foreground shadow-md border border-border/50 scale-[1.02]' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-secondary/5">
        {activeTab === 'market' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="relative mb-10 max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search the Global Capabilities Registry..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-background border-2 border-border focus:border-primary/50 shadow-sm outline-none text-base font-medium transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {marketplaceTools.map(tool => {
                const isDeployed = deployedTools.some(t => t.name === tool.name);
                return (
                  <div key={tool.name} className="glass-card p-6 border border-border hover:border-primary/50 transition-all group flex flex-col h-full shadow-lg hover:shadow-primary/5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-2xl bg-secondary/50">
                        {tool.type === 'mcp' ? <Box className="w-6 h-6 text-blue-500" /> : <Zap className="w-6 h-6 text-green-500" />}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        tool.type === 'mcp' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                      }`}>
                        {tool.type}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2 pr-4">{tool.name}</h3>
                    <p className="text-sm text-muted-foreground mb-8 leading-relaxed flex-1">
                      {tool.description}
                    </p>
                    <button 
                      onClick={() => !isDeployed && handleAcquire(tool)}
                      disabled={isDeployed}
                      className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        isDeployed 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default' 
                          : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02]'
                      }`}
                    >
                      {isDeployed ? <><CheckCircle2 className="w-4 h-4" /> Deployed</> : <><DownloadCloud className="w-4 h-4" /> Acquire Asset</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'inventory' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {deployedTools.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {deployedTools.map(tool => (
                  <div key={tool.id} className="p-6 rounded-2xl bg-background border border-border flex items-center justify-between shadow-sm group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{tool.name}</h4>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right mr-4">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Status</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase">Active</span>
                      </div>
                      <button className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                        <Settings2 className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground bg-secondary/10 rounded-3xl border-2 border-dashed border-border">
                <Box className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-xl">Asset Registry Empty</p>
                <p className="text-sm opacity-70 mt-2">Acquire capabilities from the marketplace to build your arsenal.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'allocation' && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {employees.map(spec => (
                <div key={spec.id} className="p-8 rounded-3xl bg-background border border-border shadow-sm flex flex-col gap-6">
                  <div className="flex items-center gap-4 border-b border-border pb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-xl tracking-tight uppercase">{spec.name}</h4>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Personnel Class</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Equipped Assets</span>
                    <div className="grid grid-cols-1 gap-3">
                      {deployedTools.map(tool => (
                        <button 
                          key={tool.id}
                          onClick={() => equipEmployee(spec.id, tool.id)}
                          className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/5 hover:bg-secondary/20 hover:border-primary/30 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <Box className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            <span className="font-bold text-sm">{tool.name}</span>
                          </div>
                          <Zap className="w-4 h-4 text-muted-foreground/30 group-hover:text-yellow-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Acquisition Modal */}
      <AnimatePresence>
        {isAcquireModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAcquireModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-background border-2 border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border bg-secondary/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Deploying {selectedTool?.name}</h3>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Asset Credentialing</p>
                  </div>
                </div>
                <button onClick={() => setIsAcquireModalOpen(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-4">
                  <Key className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    To deploy this capability company-wide, please provide the required operational credentials below.
                  </p>
                </div>

                {Object.keys(credentials).map(key => (
                  <div key={key} className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
                      {key.replace('_', ' ')}
                    </label>
                    <input 
                      type="password"
                      value={credentials[key]}
                      onChange={(e) => setCredentials(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Enter your ${key.replace('_', ' ')}...`}
                      className="w-full px-5 py-4 rounded-2xl bg-secondary/20 border-2 border-border focus:border-primary/50 outline-none text-base transition-all"
                    />
                  </div>
                ))}

                <button 
                  onClick={deployAsset}
                  disabled={processing}
                  className="w-full py-4 rounded-2xl bg-foreground text-background text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalize Deployment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
