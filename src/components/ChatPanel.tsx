import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { StackLabState, Recommendation } from '@/types/stacklab';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { RecommendationView } from './RecommendationView';

interface ChatPanelProps {
  state: StackLabState;
  recommendations: Recommendation[];
  onNewRecommendation: (rec: Recommendation) => void;
  onReset: () => void;
}

export function ChatPanel({ state, recommendations, onNewRecommendation, onReset }: ChatPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const { toast } = useToast();

  const latestRecommendation = recommendations[0];
  const displayContent = isLoading ? streamedContent : latestRecommendation?.rawMarkdown;

  const canGenerate = state.inventory.length > 0 || state.selectedGoals.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast({
        title: 'Add some supplements or goals first',
        description: 'Select items from your inventory and/or goals to get started.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setStreamedContent('');

    const userPrompt = buildUserPrompt(state);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-stack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('Usage limit reached. Please add credits to continue.');
        }
        throw new Error('Failed to generate recommendation');
      }

      if (!response.body) throw new Error('No response body');

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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamedContent(fullContent);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Create recommendation
      const newRec: Recommendation = {
        id: `rec-${Date.now()}`,
        rawMarkdown: fullContent,
        createdAt: new Date().toISOString(),
        inputsSnapshot: {
          inventory: [...state.inventory],
          goals: [...state.selectedGoals],
          settings: { ...state.settings },
        },
      };

      onNewRecommendation(newRec);
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            Recommendation
          </CardTitle>
          <div className="flex gap-2">
            {latestRecommendation && !isLoading && (
              <>
                <Button variant="outline" size="sm" onClick={handleGenerate} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
                <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {!displayContent && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Ready to build your stack?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Add supplements to your inventory, select your goals, and customize your plan settings.
              Then click generate to get a personalized recommendation.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isLoading}
              size="lg"
              className="gap-2"
            >
              <Sparkles className="h-5 w-5" />
              Generate Recommendation
            </Button>
            {!canGenerate && (
              <p className="text-xs text-muted-foreground mt-3">
                Add at least one supplement or goal to get started
              </p>
            )}
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="pr-4">
              {isLoading && (
                <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating your personalized stack...
                </div>
              )}
              <RecommendationView content={displayContent || ''} isStreaming={isLoading} />
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
