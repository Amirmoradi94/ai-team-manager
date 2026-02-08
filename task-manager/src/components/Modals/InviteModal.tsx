import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, UserPlus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = 'http://localhost:3001/api';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedPassword(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in to invite users');
        return;
      }

      const res = await fetch(`${API_URL}/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      // User created successfully - show password
      setGeneratedPassword(data.loginPassword);
      toast.success(`User ${email} created successfully!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-[35%] top-[25%] -translate-x-1/2 z-50 w-full max-w-md"
          >
            <div className="glass-card-dark p-6 glow-border">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Invite Team Members</h2>
                    <p className="text-sm text-muted-foreground">Collaborate with your team</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        required
                        className="pl-10 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {loading ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </form>

              {generatedPassword && (
                <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <UserPlus className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-primary mb-2">User Created Successfully</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Share these credentials with {email}:
                      </p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Email</label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              readOnly
                              value={email}
                              className="bg-secondary border-primary/30 text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(email);
                                toast.success('Email copied!');
                              }}
                              className="gap-2 border-primary/30 hover:border-primary/50"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Password</label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              readOnly
                              value={generatedPassword}
                              className="bg-secondary border-primary/30 font-mono text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedPassword);
                                toast.success('Password copied!');
                              }}
                              className="gap-2 border-primary/30 hover:border-primary/50"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
