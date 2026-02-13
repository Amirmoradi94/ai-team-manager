import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { capitalize } from '@/lib/utils';

interface AssignEmployeesModalProps {
  team: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = 'http://localhost:3001/api';

export function AssignEmployeesModal({ team, isOpen, onClose, onSuccess }: AssignEmployeesModalProps) {
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && team) {
      fetchData();
    }
  }, [isOpen, team]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [allRes, assignedRes] = await Promise.all([
        fetch(`${API_URL}/employees`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/teams`, { headers: { 'Authorization': `Bearer ${token}` } }) // To get current assignments
      ]);

      if (allRes.ok && assignedRes.ok) {
        const specs = await allRes.json();
        const teams = await assignedRes.json();
        const currentTeam = teams.find((t: any) => t.id === team.id);
        
        setAllEmployees(specs);
        setAssignedIds(currentTeam?.employees?.map((s: any) => s.id) || []);
      }
    } catch (e) {
      toast.error('Failed to load roles');
    }
  };

  const handleToggle = async (specId: string) => {
    const isAssigned = assignedIds.includes(specId);
    const token = localStorage.getItem('token');
    
    // We update the team with its full set of employee IDs
    const newIds = isAssigned 
      ? assignedIds.filter(id => id !== specId) 
      : [...assignedIds, specId];

    try {
      const res = await fetch(`${API_URL}/teams/${team.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employee_ids: newIds })
      });

      if (res.ok) {
        setAssignedIds(newIds);
        toast.success(isAssigned ? 'Role removed' : 'Role assigned');
        onSuccess();
      }
    } catch (e) {
      toast.error('Operation failed');
    }
  };

  const filtered = allEmployees.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!team) return null;

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
                    <Cpu className="w-5 h-5 text-primary" />
                    Assign Team Employees
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Team: {capitalize(team.name)}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  className="pl-9 bg-secondary/50 border-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {filtered.map(spec => (
                  <div 
                    key={spec.id}
                    onClick={() => handleToggle(spec.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      assignedIds.includes(spec.id) 
                        ? 'bg-primary/10 border-primary/50' 
                        : 'bg-secondary/30 border-transparent hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${assignedIds.includes(spec.id) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{capitalize(spec.name)}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{spec.description}</p>
                      </div>
                    </div>
                    {assignedIds.includes(spec.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground italic">No roles found.</p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <Button onClick={onClose} className="w-full">Done</Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
