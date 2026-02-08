import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Trash2, Shield, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = 'http://localhost:3001/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  created_at: string;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onUserDeleted?: () => void;
}

export function UserManagementModal({ isOpen, onClose, currentUserId, onUserDeleted }: UserManagementModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in');
        return;
      }

      const res = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You must be logged in');
        return;
      }

      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success(`User "${userName}" deleted successfully`);
      setUsers(users.filter(u => u.id !== userId));

      // Notify parent component to refresh user list
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
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
            className="fixed left-[30%] top-[20%] -translate-x-1/2 z-50 w-full max-w-2xl max-h-[80vh] overflow-hidden"
          >
            <div className="glass-card-dark p-6 glow-border flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">User Management</h2>
                    <p className="text-sm text-muted-foreground">Manage team members</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading users...
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  users.map((user) => {
                    const isCurrentUser = user.id === currentUserId;
                    const isDeleting = deletingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            {user.role === 'admin' ? (
                              <Shield className="w-5 h-5 text-primary" />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground">{user.name}</h3>
                              {user.role === 'admin' && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary border border-primary/30">
                                  Admin
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent border border-accent/30">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Joined {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {!isCurrentUser && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="gap-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {!loading && users.length > 0 && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Deleting a user will also remove all tasks they created or are assigned to.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
