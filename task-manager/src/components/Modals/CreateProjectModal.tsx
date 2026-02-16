import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderKanban, Terminal, Users, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingProject?: any | null;
}

const API_URL = 'http://localhost:3001/api';

export function CreateProjectModal({ isOpen, onClose, onSuccess, editingProject }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [globalRules, setGlobalRules] = useState('');
  const [isSubmitting, setIsPosting] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name || '');
      setDescription(editingProject.description || '');
      setRepoPath(editingProject.repository_path || '');
      setGlobalRules(editingProject.global_rules || '');
      // Load selected teams if editing
      const teamIds = editingProject.teams?.map((t: any) => t.id) || [];
      setSelectedTeams(teamIds);
    } else {
      setName('');
      setDescription('');
      setRepoPath('');
      setGlobalRules('');
      setSelectedTeams([]);
    }
  }, [editingProject, isOpen]);

  // Fetch all teams
  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    } else {
      setSelectedTeams([...selectedTeams, teamId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingProject ? `${API_URL}/projects/${editingProject.id}` : `${API_URL}/projects`;
      const method = editingProject ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          repository_path: repoPath,
          global_rules: globalRules,
          team_ids: selectedTeams
        })
      });

      if (res.ok) {
        toast.success(editingProject ? 'Project updated' : 'Project created');
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save project');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsPosting(false);
    }
  };

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
            className="relative w-full max-w-lg z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-teal-900/30 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-200/80">Portfolio Entry</p>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-teal-200" />
                    {editingProject ? 'Edit Project' : 'Create New Project'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg border border-transparent hover:border-teal-500/40 hover:bg-slate-900/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Project Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mobile App, Backend API"
                    required
                    className="bg-slate-900/70 border border-teal-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe the project goals..."
                    rows={2}
                    className="bg-slate-900/70 border border-teal-500/20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Project Rules (Global Instructions)</label>
                  <Textarea
                    value={globalRules}
                    onChange={(e) => setGlobalRules(e.target.value)}
                    placeholder="e.g. Always use Yarn, follow Airbnb style guide, no class components..."
                    rows={4}
                    className="bg-slate-900/70 border border-teal-500/20 resize-none text-sm italic"
                  />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    These rules are prepended to every agent session for this project.
                  </p>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-200" />
                    Assign Teams (Optional)
                  </label>

                  {/* Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-slate-900/70 border border-teal-500/20 rounded-xl p-3 text-sm text-foreground flex items-center justify-between hover:border-teal-400/60 transition-colors"
                  >
                    <span className="text-muted-foreground">
                      {selectedTeams.length === 0
                        ? 'Select teams...'
                        : `${selectedTeams.length} team${selectedTeams.length !== 1 ? 's' : ''} selected`
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Selected Teams (Chips) */}
                  {selectedTeams.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTeams.map(teamId => {
                        const team = teams.find(t => t.id === teamId);
                        return team ? (
                          <span
                            key={teamId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-teal-500/10 text-teal-200 rounded-full text-xs border border-teal-500/30"
                          >
                            {team.name}
                            <button
                              type="button"
                              onClick={() => toggleTeam(teamId)}
                              className="hover:bg-teal-500/20 rounded p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-900/95 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-teal-500/30 max-h-60 overflow-y-auto custom-scrollbar">
                      {teams.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground italic">
                          No teams available. Create teams first.
                        </div>
                      ) : (
                        teams.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => toggleTeam(team.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-teal-500/20 transition-colors"
                          >
                            <span>{team.name}</span>
                            {selectedTeams.includes(team.id) && (
                              <Check className="w-4 h-4 text-teal-200" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-teal-200" />
                    Local Repository Path
                  </label>
                  <Input
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    placeholder="e.g. /Users/amir/projects/my-app"
                    required
                    className="bg-slate-900/70 border border-teal-500/20 font-mono text-xs"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={onClose} className="flex-1 border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-teal-500/90 hover:bg-teal-500 text-slate-900 font-semibold">
                    {isSubmitting ? 'Saving...' : (editingProject ? 'Update Project' : 'Create Project')}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
