import { useState, useEffect } from 'react';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Brain, Rocket, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTeam?: any;
}

const API_URL = 'http://localhost:3001/api';

export function CreateTeamModal({ isOpen, onClose, onSuccess, editingTeam }: CreateTeamModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState<'mission' | 'identity' | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Team Details
  const [teamName, setTeamName] = useState('');
  const [mission, setMission] = useState('');
  const [projectId, setProjectId] = useState('');

  // Lead Details
  const [leadName, setLeadName] = useState('');
  const [leadPrompt, setLeadPrompt] = useState('');

  // Employees
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [suggestedEmployees, setSuggestedEmployees] = useState<string[]>([]);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [isAnalyzingEmployees, setIsAnalyzingEmployees] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      // Pre-fill or Reset form
      if (editingTeam) {
        setStep(1);
        setTeamName(editingTeam.name || '');
        setMission(editingTeam.mission_statement || '');

        // Lead Info
        if (editingTeam.lead) {
          setLeadName(editingTeam.lead.name || '');
          setLeadPrompt(editingTeam.lead.system_prompt || '');
        }

        // Employees
        if (editingTeam.employees) {
          setSelectedEmployees(editingTeam.employees.map((s: any) => s.id));
        } else {
          setSelectedEmployees([]);
        }
      } else {
        setStep(1);
        setTeamName('');
        setMission('');
        setProjectId('');
        setLeadName('');
        setLeadPrompt('');
        setSelectedEmployees([]);
      }
    }
  }, [isOpen, editingTeam]);

  // Auto-generate system prompt based on team details (Only for new teams)
  useEffect(() => {
    if (!editingTeam && teamName && leadName && step === 2) {
      const generatedPrompt = generateSystemPrompt(teamName, mission, leadName);
      setLeadPrompt(generatedPrompt);
    }
  }, [step, teamName, mission, leadName, editingTeam]);

  // AI-powered employee suggestions when reaching step 3
  useEffect(() => {
    if (step === 3 && teamName && mission && !editingTeam && employees.length > 0) {
      analyzeTeamNeeds();
    }
  }, [step, teamName, mission, employees, editingTeam]);

  const analyzeTeamNeeds = async () => {
    setIsAnalyzingEmployees(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/ai/suggest-team-employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teamName,
          mission
        })
      });

      if (res.ok) {
        const { employeeIds } = await res.json();
        if (employeeIds && Array.isArray(employeeIds)) {
          setSuggestedEmployees(employeeIds);
          setSelectedEmployees(employeeIds); // Pre-select suggested employees
          toast.success(`${employeeIds.length} employees recommended for this team`, {
            icon: <Sparkles className="w-4 h-4 text-primary" />
          });
        }
      }
    } catch (error) {
      console.error('Employee suggestion failed:', error);
    } finally {
      setIsAnalyzingEmployees(false);
    }
  };

  const generateSystemPrompt = (team: string, missionText: string, lead: string) => {
    const missionPart = missionText
      ? `\n\n## Mission\n${missionText}`
      : '\n\n## Mission\nExecute assigned tasks efficiently and deliver high-quality results.';

    return `# ${lead} - Lead of ${team}

You are ${lead}, the Team Lead for ${team}. You are an expert orchestrator responsible for coordinating team efforts, ensuring quality, and driving project success.${missionPart}

## Your Responsibilities
- **Strategic Planning**: Break down complex tasks into actionable steps
- **Quality Assurance**: Review all work for correctness, completeness, and best practices
- **Team Coordination**: Delegate tasks to employees when needed and synthesize their contributions
- **Decision Making**: Make informed technical and strategic decisions aligned with project goals
- **Communication**: Provide clear status updates and escalate blockers when necessary

## Your Approach
1. **Understand First**: Thoroughly analyze requirements before taking action
2. **Plan Systematically**: Create structured implementation plans with clear milestones
3. **Execute Carefully**: Write clean, maintainable code following industry best practices
4. **Verify Thoroughly**: Test your work and ensure all acceptance criteria are met
5. **Document Clearly**: Provide context for your decisions and changes

## Guidelines
- Always prioritize code quality and maintainability over speed
- Follow existing code patterns and conventions in the project
- Ask clarifying questions when requirements are ambiguous
- Proactively identify potential issues and edge cases
- Keep the human stakeholder informed of important decisions

You are professional, thorough, and committed to excellence.`;
  };

  const loadDependencies = async () => {
    try {
      const token = localStorage.getItem('token');
      const [projRes, specRes] = await Promise.all([
        fetch(`${API_URL}/projects`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/employees`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (projRes.ok) setProjects(await projRes.json());
      if (specRes.ok) setEmployees(await specRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnhance = async (type: 'mission' | 'identity') => {
    const text = type === 'mission' ? mission : leadPrompt;
    if (!text || text.length < 5) {
      toast.error('Please write a few words first so I can enhance them.');
      return;
    }

    setIsEnhancing(type);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/ai/enhance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, type })
      });

      if (res.ok) {
        const data = await res.json();
        if (type === 'mission') setMission(data.enhanced);
        else setLeadPrompt(data.enhanced);
        toast.success(`${type === 'mission' ? 'Mission' : 'Identity'} enhanced!`);
      }
    } catch (e) {
      toast.error('Failed to enhance text');
    } finally {
      setIsEnhancing(null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingTeam ? `${API_URL}/teams/${editingTeam.id}` : `${API_URL}/teams`;
      const method = editingTeam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: teamName,
          mission_statement: mission,
          human_in_the_loop: false,
          lead: {
            name: leadName,
            system_prompt: leadPrompt
          },
          employee_ids: selectedEmployees
        })
      });

      if (res.ok) {
        toast.success(editingTeam ? 'Team updated successfully' : 'Team created successfully');
        onSuccess();
        onClose();
      } else {
        throw new Error(`Failed to ${editingTeam ? 'update' : 'create'} team`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
            className="relative w-full max-w-2xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-teal-900/30 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-200/80">Command Unit</p>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-200" />
                    {editingTeam ? `Edit Team (Step ${step}/3)` : `Create New Team (Step ${step}/3)`}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg border border-transparent hover:border-teal-500/40 hover:bg-slate-900/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {step === 1 && (
                <div className="space-y-5 relative z-10">
                  <h3 className="text-lg font-medium text-foreground">Team Identity & Scope</h3>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Team Name</label>
                    <Input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Digital Marketing Squad"
                      className="bg-slate-900/70 border border-teal-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Mission Statement</label>
                    <div className="relative group">
                      <Textarea
                        value={mission}
                        onChange={(e) => setMission(e.target.value)}
                        placeholder="What is this team's north star?"
                        className="bg-slate-900/70 border border-teal-500/20 min-h-[120px] pr-10 pb-10"
                      />
                      <button
                        type="button"
                        onClick={() => handleEnhance('mission')}
                        disabled={isEnhancing !== null}
                        title="Enhance with AI"
                        className="absolute bottom-3 right-3 p-2 rounded-full bg-teal-500/10 text-teal-200 hover:bg-teal-500 hover:text-slate-900 transition-all duration-200 opacity-70 group-hover:opacity-100 disabled:opacity-50 border border-teal-500/30"
                      >
                        {isEnhancing === 'mission' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={() => setStep(2)} disabled={!teamName} className="bg-teal-500/90 hover:bg-teal-500 text-slate-900">
                      Next: Define Lead
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5 relative z-10">
                  <h3 className="text-lg font-medium text-foreground">Team Lead (Main AI Agent)</h3>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">Lead Name</label>
                    <Input
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="e.g. Chief Growth Officer"
                      className="bg-slate-900/70 border border-teal-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-teal-200" />
                      System Prompt (Expertise)
                    </label>
                    <div className="relative group">
                      <Textarea
                        value={leadPrompt}
                        onChange={(e) => setLeadPrompt(e.target.value)}
                        placeholder="A sample system prompt will be auto-generated. You can modify it or use AI enhancement ✨"
                        rows={6}
                        className="bg-slate-900/70 border border-teal-500/20 resize-none pr-10 pb-10"
                      />
                      <button
                        type="button"
                        onClick={() => handleEnhance('identity')}
                        disabled={isEnhancing !== null}
                        title="Enhance with AI"
                        className="absolute bottom-3 right-3 p-2 rounded-full bg-teal-500/10 text-teal-200 hover:bg-teal-500 hover:text-slate-900 transition-all duration-200 opacity-70 group-hover:opacity-100 disabled:opacity-50 border border-teal-500/30"
                      >
                        {isEnhancing === 'identity' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep(1)} className="border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70">Back</Button>
                    <Button onClick={() => setStep(3)} disabled={!leadName || !leadPrompt} className="bg-teal-500/90 hover:bg-teal-500 text-slate-900">
                      Next: Add Employees
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        Team Composition
                        {suggestedEmployees.length > 0 && !showAllEmployees && (
                          <span className="text-xs text-teal-200/80 font-normal">({suggestedEmployees.length} recommended)</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">Select the employees this team can call upon.</p>
                    </div>
                    {isAnalyzingEmployees && (
                      <div className="flex items-center gap-2 text-xs text-teal-200 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI analyzing team needs...
                      </div>
                    )}
                  </div>

                  {suggestedEmployees.length > 0 && !showAllEmployees ? (
                    // Show only suggested employees
                    <div className="space-y-3">
                      <div className="bg-slate-900/70 border border-teal-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-teal-200" />
                          <p className="text-xs text-muted-foreground">
                            AI analyzed your team's mission and recommended these employees
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                          {employees.filter(e => suggestedEmployees.includes(e.id)).map(spec => (
                            <div
                              key={spec.id}
                              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                selectedEmployees.includes(spec.id)
                                  ? 'bg-teal-500/10 border-teal-400'
                                  : 'bg-slate-900/60 border-teal-500/20 hover:border-teal-400/60'
                              }`}
                              onClick={() => handleToggleEmployee(spec.id)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Checkbox checked={selectedEmployees.includes(spec.id)} />
                                <span className="font-medium text-sm text-foreground">{spec.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{spec.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAllEmployees(true)}
                        className="w-full text-xs border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70"
                      >
                        Show all {employees.length} employees
                      </Button>
                    </div>
                  ) : (
                    // Show all employees
                    <div className="space-y-3">
                      {suggestedEmployees.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowAllEmployees(false)}
                          className="w-full text-xs border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70"
                        >
                          <Sparkles className="w-3 h-3 mr-2" />
                          Show only recommended employees ({suggestedEmployees.length})
                        </Button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                        {employees.map(spec => (
                          <div
                            key={spec.id}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedEmployees.includes(spec.id)
                                ? 'bg-teal-500/10 border-teal-400'
                                : 'bg-slate-900/60 border-teal-500/20 hover:border-teal-400/60'
                            }`}
                            onClick={() => handleToggleEmployee(spec.id)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Checkbox checked={selectedEmployees.includes(spec.id)} />
                              <span className="font-medium text-sm text-foreground">{spec.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{spec.description}</p>
                          </div>
                        ))}
                        {employees.length === 0 && (
                          <p className="text-muted-foreground text-sm col-span-2">No employees defined yet. You can add them later.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep(2)} className="border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70">Back</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-teal-500/90 hover:bg-teal-500 text-slate-900 gap-2">
                      <Rocket className="w-4 h-4" />
                      {isSubmitting
                        ? (editingTeam ? 'Saving Changes...' : 'Creating Team...')
                        : (editingTeam ? 'Save Changes' : 'Launch Team')
                      }
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
