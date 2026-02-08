import { Settings, Users, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function WorkspaceSettings() {
  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Workspace Settings</h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Workspace Name
        </label>
        <Input
          defaultValue="My Team Workspace"
          disabled
          className="bg-secondary border-0 opacity-50"
        />
        <p className="text-xs text-muted-foreground mt-1">Contact admin to change workspace name</p>
      </div>

      <div className="pt-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Team Members</p>
              <p className="text-xs text-muted-foreground">Manage workspace members and roles</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:border-primary/50"
            onClick={() => {/* Navigate to team tab */}}
          >
            Manage
          </Button>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-border">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Privacy & Security</p>
              <p className="text-xs text-muted-foreground">Control data access and permissions</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="border-border"
          >
            Coming Soon
          </Button>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-border">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Delete Workspace</p>
              <p className="text-xs text-muted-foreground">Permanently delete this workspace and all data</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Workspace ID: <span className="font-mono">ws_demo_001</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Created: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
