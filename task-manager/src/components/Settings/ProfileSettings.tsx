import { useState } from 'react';
import { User, Mail, Save, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface ProfileSettingsProps {
  currentUser: any;
  onUpdate: (updates: { name?: string; email?: string }) => void;
  onLogout: () => void;
}

export function ProfileSettings({ currentUser, onUpdate, onLogout }: ProfileSettingsProps) {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    onUpdate({ name, email });
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };

  const handleCancel = () => {
    setName(currentUser?.name || '');
    setEmail(currentUser?.email || '');
    setIsEditing(false);
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Profile Settings</h3>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="border-border hover:border-primary/50"
          >
            Edit Profile
          </Button>
        )}
      </div>

      <div className="flex items-center gap-6">
        <Avatar className="w-20 h-20">
          <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} />
          <AvatarFallback className="text-2xl bg-primary/10">
            {currentUser?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">Profile Picture</p>
          {isEditing && (
            <Button variant="outline" size="sm" disabled className="border-border">
              Change Avatar
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Full Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email Address
          </label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isEditing}
            type="email"
            className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            User ID
          </label>
          <Input
            value={currentUser?.id || 'N/A'}
            disabled
            className="bg-secondary border-0 opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">Your unique identifier</p>
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleSave}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-border hover:border-primary/50"
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <Button
          onClick={onLogout}
          variant="destructive"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
