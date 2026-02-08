import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plug, Circle, Terminal, Copy, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = 'http://localhost:3001/api';

interface RunnerStatus {
  hasToken: boolean;
  token: string;
  lastSeen: string | null;
  isOnline: boolean;
}

export function RunnerPage() {
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRunnerStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/runner/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRunnerStatus(data);
    } catch (error) {
      console.error('Failed to fetch runner status:', error);
    }
  };

  const generateToken = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/runner/generate-token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Runner token generated successfully');
        await fetchRunnerStatus();
      } else {
        throw new Error('Failed to generate token');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate token');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCommand = () => {
    if (!runnerStatus?.token) return;
    const command = `npx agent-runner connect --token=${runnerStatus.token} --url=${API_URL}`;
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard');
  };

  const refreshStatus = async () => {
    setIsRefreshing(true);
    await fetchRunnerStatus();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    fetchRunnerStatus();
    const interval = setInterval(fetchRunnerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getTimeSinceLastSeen = () => {
    if (!runnerStatus?.lastSeen) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(runnerStatus.lastSeen).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Plug className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Agent Runner</h1>
          </div>
          <p className="text-muted-foreground">
            Connect your local machine to execute AI-powered tasks across all your projects
          </p>
        </motion.div>

        {/* Connection Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 border border-border mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${runnerStatus?.isOnline ? 'bg-success/10' : 'bg-muted'}`}>
                <Circle className={`w-6 h-6 ${runnerStatus?.isOnline ? 'text-success fill-success animate-pulse' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {runnerStatus?.isOnline ? 'Runner Connected' : 'Runner Offline'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Last seen: {getTimeSinceLastSeen()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStatus}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {runnerStatus?.isOnline && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Active and polling for tasks</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your runner is connected and will automatically execute tasks assigned to your projects
              </p>
            </div>
          )}
        </motion.div>

        {/* Connect Command Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 border border-border mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Connection Command</h3>
          </div>

          {!runnerStatus?.hasToken ? (
            <div className="text-center py-8">
              <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                You haven't generated a runner token yet
              </p>
              <Button onClick={generateToken} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Runner Token'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Run this command in your terminal to connect your machine:
              </p>

              <div className="relative bg-black/40 rounded-lg p-4 border border-white/5 group/cmd">
                <code className="text-sm text-primary font-mono block break-all leading-relaxed">
                  npx agent-runner connect --token={runnerStatus.token} --url={API_URL}
                </code>
                <button
                  onClick={copyCommand}
                  className="absolute top-3 right-3 p-2 rounded bg-secondary/80 hover:bg-secondary opacity-0 group-hover/cmd:opacity-100 transition-all hover:scale-105"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> This single connection works for all your projects. No need to connect each project separately!
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 border border-border"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">How It Works</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="text-foreground font-medium">Connect your machine</p>
                <p className="text-sm text-muted-foreground">
                  Run the command above in your terminal to connect your local development environment
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="text-foreground font-medium">Create projects & tasks</p>
                <p className="text-sm text-muted-foreground">
                  Define your projects with repository paths, then create tasks and assign them to projects
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="text-foreground font-medium">AI executes automatically</p>
                <p className="text-sm text-muted-foreground">
                  The runner polls for tasks, switches to the correct project directory, and executes using Claude, Gemini, or OpenAI
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
