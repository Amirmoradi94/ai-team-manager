import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Wrench, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { EmployeeTemplate } from '@/data/employeeTemplates';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  template?: EmployeeTemplate | null;
}

const API_URL = 'http://localhost:3001/api';

export function CreateEmployeeModal({ isOpen, onClose, onSuccess, template }: CreateEmployeeModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isSubmitting, setIsPosting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [skillsByCategory, setSkillsByCategory] = useState<Record<string, any[]>>({});

  // AI Auto-suggestion logic
  const analyzeSkills = useCallback(async (currentName: string, currentDesc: string) => {
    if (!currentDesc || currentDesc.length < 10) return;

    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/ai/analyze-skills`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: currentName, description: currentDesc })
      });

      if (res.ok) {
        const { skillIds } = await res.json();
        if (skillIds && Array.isArray(skillIds)) {
          setSuggestedSkills(skillIds);
          setSelectedTools(skillIds);
          toast.success(`${skillIds.length} essential skills suggested`, {
            icon: <Sparkles className="w-4 h-4 text-primary" />
          });
        }
      }
    } catch (error) {
      console.error('Skill analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Pre-fill form when template is provided
  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description);
      setSystemPrompt(template.systemPrompt);
      setSelectedTools(template.tools || []);
      // Auto-analyze template to get suggested skills
      analyzeSkills(template.name, template.description);
    } else if (isOpen && !template) {
      // Reset form when opening without template
      setName('');
      setDescription('');
      setSystemPrompt('');
      setSelectedTools([]);
      setSuggestedSkills([]);
      setShowAllSkills(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, template]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchSkills = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/skills`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setSkills(list);
        const grouped = list.reduce((acc: Record<string, any[]>, skill: any) => {
          const category = skill.category || 'General';
          if (!acc[category]) acc[category] = [];
          acc[category].push(skill);
          return acc;
        }, {});
        setSkillsByCategory(grouped);
      } catch (err) {
        console.error('Failed to load skills', err);
      }
    };
    fetchSkills();
  }, [isOpen]);

  // Debounce description changes for analysis
  useEffect(() => {
    if (!isOpen || template) return; // Don't auto-analyze if using a template or closed

    const timer = setTimeout(() => {
      if (description.length > 15) {
        analyzeSkills(name, description);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [description, name, isOpen, template, analyzeSkills]);

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          system_prompt: systemPrompt,
          tools: selectedTools
        })
      });

      if (res.ok) {
        toast.success('Employee hired successfully');
        onSuccess();
        onClose();
        setName('');
        setDescription('');
        setSystemPrompt('');
        setSelectedTools([]);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to hire employee');
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
            className="relative w-full max-w-5xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-8 shadow-[0_25px_60px_rgba(0,0,0,0.35)] max-h-[92vh] overflow-hidden">
              <div className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    {template ? `Hire: ${template.name}` : 'Hire Employee'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure the specialized skills and instructions for your new hire.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Employee Class</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. React Expert, SQL Optimizer"
                      required
                      className="bg-slate-900/70 border border-teal-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Brief Description</label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is their primary responsibility?"
                      className="bg-slate-900/70 border border-teal-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Core Instructions (System Prompt)</label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Provide specific instructions for this employee..."
                    rows={4}
                    required
                    className="bg-slate-900/70 border border-teal-500/20 resize-none text-sm italic"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" />
                      {suggestedSkills.length > 0 && !showAllSkills ? 'Essential Skills' : 'Specialized Skills'}
                      {suggestedSkills.length > 0 && !showAllSkills && (
                        <span className="text-xs text-teal-200/80 font-normal">({suggestedSkills.length} suggested)</span>
                      )}
                    </label>
                    {isAnalyzing && (
                      <div className="flex items-center gap-2 text-xs text-teal-200/80 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI is analyzing requirements...
                      </div>
                    )}
                  </div>

                  {/* Show suggested skills only (when available and not showing all) */}
                  {suggestedSkills.length > 0 && !showAllSkills ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-teal-500/25 bg-slate-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <p className="text-xs text-muted-foreground">
                            AI analyzed this employee and identified these essential skills
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {suggestedSkills.map(skillId => {
                            const skill = skills.find(s => s.id === skillId);
                            if (!skill) return null;
                            return (
                              <div key={skill.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={skill.id}
                                  checked={selectedTools.includes(skill.id)}
                                  onCheckedChange={() => toggleTool(skill.id)}
                                  className="w-3.5 h-3.5"
                                />
                                <label
                                  htmlFor={skill.id}
                                  className={`text-[11px] cursor-pointer select-none transition-colors ${
                                    selectedTools.includes(skill.id) ? 'text-teal-200 font-medium' : 'text-muted-foreground'
                                  }`}
                                  title={skill.description}
                                >
                                  {skill.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAllSkills(true)}
                        className="w-full text-xs border-teal-500/30 text-teal-100 hover:bg-teal-500/10"
                      >
                        Show all {skills.length} skills
                      </Button>
                    </div>
                  ) : (
                    /* Show all skills organized by category */
                    <div className="space-y-4">
                      {suggestedSkills.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowAllSkills(false)}
                          className="w-full text-xs mb-2"
                        >
                          <Sparkles className="w-3 h-3 mr-2" />
                          Show only essential skills ({suggestedSkills.length})
                        </Button>
                      )}
                      {Object.entries(skillsByCategory).map(([category, skills]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">
                            {category}
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-2xl border border-teal-500/20">
                            {skills.map(skill => (
                              <div key={skill.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={skill.id}
                                  checked={selectedTools.includes(skill.id)}
                                  onCheckedChange={() => toggleTool(skill.id)}
                                  className="w-3.5 h-3.5"
                                />
                                <label
                                  htmlFor={skill.id}
                                  className={`text-[11px] cursor-pointer select-none transition-colors ${
                                    selectedTools.includes(skill.id) ? 'text-teal-200 font-medium' : 'text-muted-foreground'
                                  }`}
                                  title={skill.description}
                                >
                                  {skill.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-teal-500/20">
                  <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-teal-400 text-slate-900 hover:bg-teal-300">
                    {isSubmitting ? 'Hiring...' : 'Hire Employee'}
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
