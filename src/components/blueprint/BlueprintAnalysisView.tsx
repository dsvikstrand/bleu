import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BlueprintAnalysisViewProps {
  review: string;
  isStreaming?: boolean;
}

export function BlueprintAnalysisView({ review, isStreaming }: BlueprintAnalysisViewProps) {
  // Parse sections from markdown
  const sections = parseReviewSections(review);

  return (
    <Card className="bg-card/80 backdrop-blur-glass border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-muted/30 px-4 pt-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              OVERVIEW
            </TabsTrigger>
            <TabsTrigger value="strengths" className="data-[state=active]:bg-background">
              STRENGTHS
            </TabsTrigger>
            <TabsTrigger value="gaps" className="data-[state=active]:bg-background">
              GAPS
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="data-[state=active]:bg-background">
              SUGGESTIONS
            </TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Overview</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {sections.overview || (isStreaming ? 'Generating...' : 'No overview available.')}
                </p>
              </div>
              {sections.verdict && (
                <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <h4 className="font-semibold text-primary mb-1">Quick Verdict</h4>
                  <p className="text-sm">{sections.verdict}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="strengths" className="mt-0">
              <h3 className="text-2xl font-bold tracking-tight mb-4">Strengths</h3>
              {sections.strengths.length > 0 ? (
                <ul className="space-y-3">
                  {sections.strengths.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-primary font-bold">+</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  {isStreaming ? 'Analyzing strengths...' : 'No strengths identified.'}
                </p>
              )}
            </TabsContent>

            <TabsContent value="gaps" className="mt-0">
              <h3 className="text-2xl font-bold tracking-tight mb-4">Gaps / Risks</h3>
              {sections.gaps.length > 0 ? (
                <ul className="space-y-3">
                  {sections.gaps.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-destructive font-bold">!</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  {isStreaming ? 'Identifying gaps...' : 'No gaps identified.'}
                </p>
              )}
            </TabsContent>

            <TabsContent value="suggestions" className="mt-0">
              <h3 className="text-2xl font-bold tracking-tight mb-4">Suggestions</h3>
              {sections.suggestions.length > 0 ? (
                <ul className="space-y-3">
                  {sections.suggestions.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-accent font-bold">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  {isStreaming ? 'Generating suggestions...' : 'No suggestions available.'}
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {isStreaming && (
          <div className="px-6 pb-4">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ParsedSections {
  overview: string;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  verdict: string;
}

function parseReviewSections(markdown: string): ParsedSections {
  const result: ParsedSections = {
    overview: '',
    strengths: [],
    gaps: [],
    suggestions: [],
    verdict: '',
  };

  if (!markdown) return result;

  const lines = markdown.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (line.startsWith('### ') || line.startsWith('## ')) {
      if (lowerLine.includes('overview')) currentSection = 'overview';
      else if (lowerLine.includes('strength')) currentSection = 'strengths';
      else if (lowerLine.includes('gap') || lowerLine.includes('risk')) currentSection = 'gaps';
      else if (lowerLine.includes('suggest')) currentSection = 'suggestions';
      else if (lowerLine.includes('verdict')) currentSection = 'verdict';
      else currentSection = '';
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Clean up markdown artifacts
    const cleaned = trimmed
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^\*|\*$/g, '')
      .replace(/^- /, '');

    switch (currentSection) {
      case 'overview':
        result.overview += (result.overview ? ' ' : '') + cleaned;
        break;
      case 'strengths':
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          result.strengths.push(cleaned);
        }
        break;
      case 'gaps':
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          result.gaps.push(cleaned);
        }
        break;
      case 'suggestions':
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          result.suggestions.push(cleaned);
        }
        break;
      case 'verdict':
        result.verdict += (result.verdict ? ' ' : '') + cleaned;
        break;
    }
  }

  return result;
}
