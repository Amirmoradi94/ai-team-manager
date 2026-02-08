import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Webhook, Lock, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export function IntegrationSettings() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const settings = await response.json();
        setWebhookUrl(settings.claude_webhook_url || '');
        setWebhookSecret(settings.claude_webhook_secret || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setIsSaved(false);

    try {
      const token = localStorage.getItem('token');

      // Save webhook URL
      const urlResponse = await fetch('http://localhost:3001/api/settings/claude_webhook_url', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: webhookUrl })
      });

      // Save webhook secret
      const secretResponse = await fetch('http://localhost:3001/api/settings/claude_webhook_secret', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: webhookSecret })
      });

      if (urlResponse.ok && secretResponse.ok) {
        setIsSaved(true);
        toast({
          title: "Settings saved",
          description: "Claude webhook integration has been configured successfully.",
        });

        // Reset saved indicator after 3 seconds
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast({
        title: "No webhook URL",
        description: "Please enter a webhook URL first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    console.log('[Test Webhook] Testing webhook with URL:', webhookUrl);
    console.log('[Test Webhook] Secret:', webhookSecret ? 'Set' : 'Not set');

    try {
      const testPayload = {
        id: 'test-webhook-' + Date.now(),
        title: 'Test Webhook',
        description: 'This is a test webhook from Task Manager settings.',
        status: 'todo',
        priority: 'medium',
        assignee_name: 'claude'
      };

      console.log('[Test Webhook] Sending payload:', testPayload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret || 'test-secret'
        },
        body: JSON.stringify(testPayload)
      });

      console.log('[Test Webhook] Response status:', response.status);
      const responseData = await response.json().catch(() => ({}));
      console.log('[Test Webhook] Response data:', responseData);

      if (response.ok) {
        toast({
          title: "✅ Webhook test successful!",
          description: "Claude scheduler received the test webhook.",
        });
      } else {
        throw new Error(`Webhook responded with status ${response.status}: ${responseData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('[Test Webhook] Error:', error);
      const errorMsg = error instanceof Error ? error.message : "Could not reach the webhook URL.";
      console.error('[Test Webhook] Full error:', errorMsg);
      toast({
        title: "❌ Webhook test failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <CardTitle>Claude Integration</CardTitle>
        </div>
        <CardDescription>
          Configure webhook integration to automatically notify Claude when tasks are assigned
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            When you assign a task to Claude, a webhook will be sent to the URL below to trigger immediate execution.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="webhook-url">Claude Webhook URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="http://localhost:3002/webhook/task-assigned"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-sm text-muted-foreground">
            The URL where Claude's task scheduler is listening for webhooks
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-secret">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Webhook Secret (Optional)
            </div>
          </Label>
          <div className="relative">
            <Input
              id="webhook-secret"
              type={showSecret ? "text" : "password"}
              placeholder="your-webhook-secret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
            >
              {showSecret ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Secret key for authenticating webhook requests. Must match Claude scheduler config.
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading || !webhookUrl}
            className="flex-1"
          >
            {isSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
          <Button
            onClick={handleTest}
            variant="outline"
            disabled={loading || !webhookUrl}
            className={!loading && webhookUrl ? 'cursor-pointer' : ''}
          >
            {loading ? 'Testing...' : 'Test Webhook'}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">How it works:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Enter the webhook URL where Claude scheduler is running</li>
            <li>Optionally set a secret key for security</li>
            <li>Save the settings</li>
            <li>When you assign a task to "Claude", a webhook is sent automatically</li>
            <li>Claude receives the task and executes it immediately</li>
          </ol>
        </div>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            💡 Tip: If Claude scheduler is running locally, use <code className="bg-muted px-1 py-0.5 rounded">http://localhost:3002/webhook/task-assigned</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
