import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useBlendState } from '@/hooks/useBlendState';
import { BlendInventoryPicker } from '@/components/blend/BlendInventoryPicker';
import { BlendDoseModal } from '@/components/blend/BlendDoseModal';
import { BlendRecipeCard } from '@/components/blend/BlendRecipeCard';
import { BlendAnalysisView } from '@/components/blend/BlendAnalysisView';
import { BlendHistory } from '@/components/blend/BlendHistory';
import { CocktailLoadingAnimation } from '@/components/blend/CocktailLoadingAnimation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  SupplementCategory,
  DoseUnit,
  BlendItem,
  BlendAnalysis,
} from '@/types/stacklab';
import { Beaker, FlaskConical, RotateCcw } from 'lucide-react';

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-blend`;

const Blend = () => {
  const {
    currentBlend,
    history,
    createBlend,
    addItem,
    updateItem,
    removeItem,
    updateBlendName,
    saveAnalysis,
    clearCurrentBlend,
    loadFromHistory,
    deleteFromHistory,
    resetAll,
  } = useBlendState();

  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamingAnalysis, setStreamingAnalysis] = useState<string>('');

  // Modal state for adding items
  const [doseModalOpen, setDoseModalOpen] = useState(false);
  const [pendingSupplement, setPendingSupplement] = useState<{
    id: string;
    name: string;
    category: SupplementCategory;
  } | null>(null);

  // Get selected supplement IDs for the picker
  const selectedIds = useMemo(() => {
    if (!currentBlend) return new Set<string>();
    return new Set(currentBlend.items.map((item) => item.supplementId));
  }, [currentBlend]);

  // Handle supplement selection from picker
  const handleSelectSupplement = useCallback(
    (supplementId: string, name: string, category: SupplementCategory) => {
      // If already in blend, remove it
      if (currentBlend?.items.some((i) => i.supplementId === supplementId)) {
        const item = currentBlend.items.find((i) => i.supplementId === supplementId);
        if (item) removeItem(item.id);
        return;
      }

      // Ensure we have a current blend
      if (!currentBlend) {
        createBlend();
      }

      // Open dose modal
      setPendingSupplement({ id: supplementId, name, category });
      setDoseModalOpen(true);
    },
    [currentBlend, createBlend, removeItem]
  );

  // Handle dose confirmation
  const handleConfirmDose = useCallback(
    (amount: number, unit: DoseUnit) => {
      if (!pendingSupplement) return;

      // Ensure blend exists
      if (!currentBlend) {
        createBlend();
      }

      const newItem: BlendItem = {
        id: `item-${Date.now()}`,
        supplementId: pendingSupplement.id,
        name: pendingSupplement.name,
        category: pendingSupplement.category,
        amount,
        unit,
      };

      addItem(newItem);
      setDoseModalOpen(false);
      setPendingSupplement(null);
    },
    [pendingSupplement, currentBlend, createBlend, addItem]
  );

  // Handle update item dose
  const handleUpdateItemDose = useCallback(
    (itemId: string, amount: number, unit: DoseUnit) => {
      updateItem(itemId, { amount, unit });
    },
    [updateItem]
  );

  // Analyze the blend
  const handleAnalyze = useCallback(async () => {
    if (!currentBlend || currentBlend.items.length === 0) return;

    setIsAnalyzing(true);
    setStreamingAnalysis('');

    try {
      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          blendName: currentBlend.name,
          items: currentBlend.items.map((item) => ({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze blend');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamingAnalysis(fullContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse and save the analysis
      const analysis = parseAnalysis(fullContent);
      saveAnalysis(analysis);
      setStreamingAnalysis('');

      toast({
        title: '🍸 Blend Analyzed!',
        description: `Your ${currentBlend.name} has been classified as: ${analysis.classification || 'Custom Blend'}`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentBlend, saveAnalysis, toast]);

  // Parse the raw markdown into structured analysis
  function parseAnalysis(markdown: string): BlendAnalysis {
    let classification = '';
    let score = 0;
    let summary = '';
    let timing = '';
    const tweaks: string[] = [];
    const warnings: string[] = [];

    const lines = markdown.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (line.startsWith('### ')) {
        if (lowerLine.includes('classification')) currentSection = 'classification';
        else if (lowerLine.includes('score') || lowerLine.includes('effectiveness'))
          currentSection = 'score';
        else if (lowerLine.includes('summary')) currentSection = 'summary';
        else if (lowerLine.includes('when') || lowerLine.includes('timing'))
          currentSection = 'timing';
        else if (lowerLine.includes('tweak') || lowerLine.includes('suggest'))
          currentSection = 'tweaks';
        else if (lowerLine.includes('warning') || lowerLine.includes('interaction'))
          currentSection = 'warnings';
        else currentSection = '';
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      switch (currentSection) {
        case 'classification':
          if (!classification) classification = trimmed.replace(/^\*\*|\*\*$/g, '');
          break;
        case 'score':
          const scoreMatch = trimmed.match(/(\d+)\s*\/\s*10/);
          if (scoreMatch) score = parseInt(scoreMatch[1], 10);
          break;
        case 'summary':
          summary += (summary ? ' ' : '') + trimmed;
          break;
        case 'timing':
          timing += (timing ? ' ' : '') + trimmed;
          break;
        case 'tweaks':
          if (trimmed.startsWith('- ')) tweaks.push(trimmed.slice(2));
          break;
        case 'warnings':
          if (trimmed.startsWith('- ')) warnings.push(trimmed.slice(2));
          break;
      }
    }

    return {
      classification,
      score,
      summary,
      timing,
      tweaks,
      warnings,
      rawMarkdown: markdown,
    };
  }

  // Handle starting a new blend
  const handleNewBlend = useCallback(() => {
    clearCurrentBlend();
    createBlend();
  }, [clearCurrentBlend, createBlend]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Blend Builder</h1>
                <p className="text-xs text-muted-foreground">Create Your Cocktail</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center gap-1 ml-4 p-1 bg-muted rounded-lg">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Beaker className="h-4 w-4" />
                  StackLab
                </Button>
              </Link>
              <Button variant="secondary" size="sm" className="gap-2 pointer-events-none">
                <FlaskConical className="h-4 w-4" />
                Blend Builder
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewBlend}>
              New Blend
            </Button>
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-120px)]">
          {/* Left Panel - Picker & History */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <BlendInventoryPicker
              selectedIds={selectedIds}
              onSelect={handleSelectSupplement}
            />

            <BlendHistory
              history={history}
              onLoad={loadFromHistory}
              onDelete={deleteFromHistory}
            />
          </div>

          {/* Right Panel - Recipe & Analysis */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Current Blend Card */}
            {currentBlend ? (
              <BlendRecipeCard
                blend={currentBlend}
                onUpdateName={updateBlendName}
                onUpdateItem={handleUpdateItemDose}
                onRemoveItem={removeItem}
                onClear={clearCurrentBlend}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FlaskConical className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Start Your Blend
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Select supplements from the picker to create your custom cocktail
                  </p>
                  <Button onClick={createBlend}>
                    Create New Blend
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loading Animation */}
            {isAnalyzing && (
              <Card>
                <CardContent className="p-0">
                  <CocktailLoadingAnimation />
                </CardContent>
              </Card>
            )}

            {/* Streaming Analysis Preview */}
            {streamingAnalysis && !currentBlend?.analysis && (
              <BlendAnalysisView
                analysis={{
                  classification: '',
                  score: 0,
                  summary: '',
                  timing: '',
                  tweaks: [],
                  warnings: [],
                  rawMarkdown: streamingAnalysis,
                }}
                isStreaming
              />
            )}

            {/* Final Analysis */}
            {currentBlend?.analysis && !isAnalyzing && (
              <BlendAnalysisView analysis={currentBlend.analysis} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            ⚠️ Blend Builder is for educational purposes only. Always consult a healthcare
            provider before starting any supplement regimen.
          </p>
        </div>
      </footer>

      {/* Dose Modal */}
      {pendingSupplement && (
        <BlendDoseModal
          open={doseModalOpen}
          onClose={() => {
            setDoseModalOpen(false);
            setPendingSupplement(null);
          }}
          onConfirm={handleConfirmDose}
          supplementId={pendingSupplement.id}
          supplementName={pendingSupplement.name}
        />
      )}
    </div>
  );
};

export default Blend;
