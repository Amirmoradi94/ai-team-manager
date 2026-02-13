import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Lightbulb, Code, TrendingUp, Settings, ChevronRight, DollarSign, Zap, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { SPECIALIST_TEMPLATES, CATEGORIES, EmployeeTemplate } from '@/data/employeeTemplates';

const API_URL = 'http://localhost:3001/api';

interface EmployeeTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: EmployeeTemplate) => void;
  onCreateFromScratch: () => void;
}

const CATEGORY_ICONS = {
  Planning: Lightbulb,
  Building: Code,
  Marketing: TrendingUp,
  Sales: DollarSign,
  Operations: Settings,
  Specialized: Zap
};

const CATEGORY_COLORS = {
  Planning: 'text-yellow-500',
  Building: 'text-blue-500',
  Marketing: 'text-green-500',
  Sales: 'text-emerald-500',
  Operations: 'text-purple-500',
  Specialized: 'text-pink-500'
};

export function EmployeeTemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateFromScratch
}: EmployeeTemplatesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number] | 'All'>('All');
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [goal, setGoal] = useState('');
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const handleGetRecommendations = async () => {
    if (!goal || goal.trim().length < 5) {
      toast.error('Please describe your goal (at least 5 characters)');
      return;
    }

    setIsLoadingRecommendations(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goal,
          employees: SPECIALIST_TEMPLATES
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendedIds(data.recommendedIds || []);
        setReasoning(data.reasoning || '');
        setSelectedRoleIds(data.recommendedIds || []); // Auto-select all recommended
        toast.success(`Found ${data.recommendedIds?.length || 0} recommended roles!`);
      } else {
        throw new Error('Failed to get recommendations');
      }
    } catch (err) {
      toast.error('Failed to get AI recommendations. Please try again.');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleToggleSelection = (templateId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleBulkAdd = async () => {
    if (selectedRoleIds.length === 0) {
      toast.error('Please select at least one role');
      return;
    }

    const token = localStorage.getItem('token');
    let successCount = 0;
    let errorCount = 0;

    for (const templateId of selectedRoleIds) {
      const template = SPECIALIST_TEMPLATES.find(t => t.id === templateId);
      if (!template) continue;

      try {
        const res = await fetch(`${API_URL}/employees`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            system_prompt: template.systemPrompt,
            tools: template.tools
          })
        });

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully added ${successCount} role${successCount > 1 ? 's' : ''}`);
      onClose();
      // Trigger a page refresh or callback to reload employees
      window.location.reload();
    }
    if (errorCount > 0) {
      toast.error(`Failed to add ${errorCount} role${errorCount > 1 ? 's' : ''}`);
    }
  };

  const filteredTemplates = SPECIALIST_TEMPLATES.filter(template => {
    // If we have recommendations, ONLY show recommended employees
    if (recommendedIds.length > 0) {
      return recommendedIds.includes(template.id);
    }

    // Otherwise, apply normal filters
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const templatesByCategory = CATEGORIES.map(category => ({
    category,
    templates: filteredTemplates.filter(t => t.category === category)
  })).filter(group => group.templates.length > 0);

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
            className="relative w-full max-w-6xl z-10 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-card-dark p-6 glow-border flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                    <Lightbulb className="w-6 h-6 text-primary" />
                    Employee Templates
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose from {SPECIALIST_TEMPLATES.length} ready-to-use employees or hire your own
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search and Filter */}
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    className="pl-9 bg-secondary/50 border-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={onCreateFromScratch}
                  className="whitespace-nowrap"
                >
                  Hire from Scratch
                </Button>
              </div>

              {/* AI Recommendations */}
              <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">AI-Powered Recommendations</h3>
                </div>
                <div className="flex gap-2 items-start">
                  <Input
                    placeholder="e.g., I want to build a complete digital marketing team"
                    className="bg-secondary/50 border-0 text-sm"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                  <Button
                    onClick={handleGetRecommendations}
                    disabled={isLoadingRecommendations || !goal.trim()}
                    className="bg-primary hover:bg-primary/90 whitespace-nowrap shrink-0"
                    size="default"
                  >
                    {isLoadingRecommendations ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {recommendedIds.length > 0 && (
                  <div className="mt-3 p-3 rounded bg-secondary/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">
                        ✨ {recommendedIds.length} Employees Recommended
                      </p>
                      <button
                        onClick={() => {
                          setRecommendedIds([]);
                          setReasoning('');
                          setGoal('');
                          setSelectedRoleIds([]);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleBulkAdd}
                        disabled={selectedRoleIds.length === 0}
                        className="flex-1 bg-primary hover:bg-primary/90 text-sm h-9"
                      >
                        Hire Selected ({selectedRoleIds.length})
                      </Button>
                      <Button
                        onClick={() => setShowReviewModal(true)}
                        disabled={selectedRoleIds.length === 0}
                        variant="outline"
                        className="flex-1 text-sm h-9"
                      >
                        Review & Customize
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 mb-6 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === 'All'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  All ({SPECIALIST_TEMPLATES.length})
                </button>
                {CATEGORIES.map(category => {
                  const Icon = CATEGORY_ICONS[category];
                  const count = SPECIALIST_TEMPLATES.filter(t => t.category === category).length;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        selectedCategory === category
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {category} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Templates Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {templatesByCategory.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No employees found matching your search.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {templatesByCategory.map(({ category, templates }) => {
                      const Icon = CATEGORY_ICONS[category];
                      const colorClass = CATEGORY_COLORS[category];

                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-4">
                            <Icon className={`w-5 h-5 ${colorClass}`} />
                            <h3 className="text-lg font-semibold text-foreground">{category}</h3>
                            <span className="text-xs text-muted-foreground">({templates.length})</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {templates.map(template => {
                              const isRecommended = recommendedIds.includes(template.id);
                              const isSelected = selectedRoleIds.includes(template.id);
                              return (
                                <motion.div
                                  key={template.id}
                                  whileHover={{ scale: 1.02 }}
                                  className={`glass-card p-4 border transition-all cursor-pointer group relative ${
                                    isSelected
                                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                      : isRecommended
                                      ? 'border-primary/70 bg-primary/5 shadow-lg shadow-primary/20'
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                  onClick={() => onSelectTemplate(template)}
                                >
                                  {/* Checkbox for bulk selection when recommendations are active */}
                                  {recommendedIds.length > 0 && (
                                    <div
                                      className="absolute top-3 left-3 z-10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelection(template.id);
                                      }}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        className="bg-background border-2"
                                      />
                                    </div>
                                  )}

                                  {isRecommended && (
                                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                                      <Sparkles className="w-3 h-3" />
                                    </div>
                                  )}
                                  <div className={`flex items-start justify-between mb-3 ${recommendedIds.length > 0 ? 'ml-8' : ''}`}>
                                    <h4 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                                      {template.name}
                                    </h4>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                                  </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                  {template.description}
                                </p>

                                <div className="flex flex-wrap gap-1">
                                  {template.tools.slice(0, 3).map(tool => (
                                    <span
                                      key={tool}
                                      className="text-xs px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground"
                                    >
                                      {tool.replace('_', ' ')}
                                    </span>
                                  ))}
                                  {template.tools.length > 3 && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                                      +{template.tools.length - 3}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Review Modal */}
          <AnimatePresence>
            {showReviewModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowReviewModal(false)}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-4xl z-10 max-h-[90vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="glass-card-dark p-6 glow-border flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="w-6 h-6 text-primary" />
                          Review Selected Employees ({selectedRoleIds.length})
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Review and customize employees before hiring them for your company
                        </p>
                      </div>
                      <button
                        onClick={() => setShowReviewModal(false)}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Selected Roles List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-6">
                      {selectedRoleIds.map(roleId => {
                        const template = SPECIALIST_TEMPLATES.find(t => t.id === roleId);
                        if (!template) return null;

                        return (
                          <div
                            key={roleId}
                            className="glass-card p-5 border border-primary/30 bg-primary/5 hover:border-primary/50 transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-foreground mb-2">{template.name}</h3>
                                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>

                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-primary/80 uppercase tracking-wide">System Prompt Preview</p>
                                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-green-400/80 max-h-32 overflow-y-auto line-clamp-4">
                                    {template.systemPrompt}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1 mt-3">
                                  <span className="text-[10px] font-semibold text-primary/60 uppercase tracking-wide mr-2">Tools:</span>
                                  {template.tools.map(tool => (
                                    <span
                                      key={tool}
                                      className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                                    >
                                      {tool.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={() => handleToggleSelection(roleId)}
                                className="ml-4 p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                                title="Remove from selection"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowReviewModal(false);
                                onSelectTemplate(template);
                              }}
                              className="w-full mt-3"
                            >
                              Customize This Employee
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        onClick={() => setShowReviewModal(false)}
                        className="flex-1"
                      >
                        Back to Selection
                      </Button>
                      <Button
                        onClick={() => {
                          handleBulkAdd();
                          setShowReviewModal(false);
                        }}
                        disabled={selectedRoleIds.length === 0}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        Hire All {selectedRoleIds.length} Employees
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
