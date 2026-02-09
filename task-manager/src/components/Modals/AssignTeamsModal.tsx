import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { capitalize } from '@/lib/utils';

interface AssignTeamsModalProps {
  project: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = 'http://localhost:3001/api';

export function AssignTeamsModal({ project, isOpen, onClose, onSuccess }: AssignTeamsModalProps) {
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      fetchData();
    }
  }, [isOpen, project]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [teamsRes, assignedRes] = await Promise.all([
        fetch(`${API_URL}/teams`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/projects/${project.id}/teams`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (teamsRes.ok && assignedRes.ok) {
        const teams = await teamsRes.json();
        const assigned = await assignedRes.json();
        setAllTeams(teams);
        setAssignedTeamIds(assigned.map((t: any) => t.id));
      }
    } catch (e) {
      toast.error('Failed to load teams');
    }
  };

  const handleToggleTeam = async (teamId: string) => {
    const isAssigned = assignedTeamIds.includes(teamId);
    const token = localStorage.getItem('token');
    
    try {
      const method = isAssigned ? 'DELETE' : 'POST';
      const url = `${API_URL}/projects/${project.id}/teams/${teamId}`;
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setAssignedTeamIds(prev => 
          isAssigned ? prev.filter(id => id !== teamId) : [...prev, teamId]
        );
        toast.success(isAssigned ? 'Team removed' : 'Team assigned');
      }
    } catch (e) {
      toast.error('Operation failed');
    }
  };

  const filteredTeams = allTeams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-card-dark p-6 glow-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Assign Teams
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Project: {capitalize(project.name)}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search teams..." 
                  className="pl-9 bg-secondary/50 border-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredTeams.map(team => (
                  <div 
                    key={team.id}
                    onClick={() => handleToggleTeam(team.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      assignedTeamIds.includes(team.id) 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'bg-secondary/30 border-transparent hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${assignedTeamIds.includes(team.id) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{capitalize(team.name)}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{team.mission_statement}</p>
                      </div>
                    </div>
                    {assignedTeamIds.includes(team.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
                {filteredTeams.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground italic">No teams found.</p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <Button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
