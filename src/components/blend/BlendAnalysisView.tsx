import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BlendAnalysis } from '@/types/stacklab';
import { Tag, Star, FileText, Clock, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';

interface BlendAnalysisViewProps {
  analysis: BlendAnalysis;
  isStreaming?: boolean;
}

interface ParsedSection {
  title: string;
  content: string;
  icon: React.ReactNode;
  type: 'default' | 'warning' | 'success';
}

function parseAnalysisMarkdown(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];

  const iconMap: Record<string, { icon: React.ReactNode; type: 'default' | 'warning' | 'success' }> = {
    'classification': { icon: <Tag className="h-4 w-4" />, type: 'success' },
    'effectiveness': { icon: <Star className="h-4 w-4" />, type: 'default' },
    'score': { icon: <Star className="h-4 w-4" />, type: 'default' },
    'summary': { icon: <FileText className="h-4 w-4" />, type: 'default' },
    'when': { icon: <Clock className="h-4 w-4" />, type: 'default' },
    'timing': { icon: <Clock className="h-4 w-4" />, type: 'default' },
    'tweak': { icon: <Sparkles className="h-4 w-4" />, type: 'success' },
    'suggest': { icon: <Sparkles className="h-4 w-4" />, type: 'success' },
    'warning': { icon: <AlertTriangle className="h-4 w-4" />, type: 'warning' },
    'interaction': { icon: <AlertTriangle className="h-4 w-4" />, type: 'warning' },
    'tip': { icon: <Lightbulb className="h-4 w-4" />, type: 'default' },
    'pro': { icon: <Lightbulb className="h-4 w-4" />, type: 'default' },
  };

  const getIconInfo = (title: string) => {
    const lowerTitle = title.toLowerCase();
    for (const [key, value] of Object.entries(iconMap)) {
      if (lowerTitle.includes(key)) return value;
    }
    return { icon: <FileText className="h-4 w-4" />, type: 'default' as const };
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        if (currentSection.content) sections.push(currentSection);
      }
      const title = line.replace(/^###\s*/, '').trim();
      const { icon, type } = getIconInfo(title);
      currentSection = { title, content: '', icon, type };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    if (currentSection.content) sections.push(currentSection);
  }

  return sections;
}

function formatContent(content: string) {
  return content.split('\n').map((line, i) => {
    // Handle bullet points
    if (line.trim().startsWith('- ')) {
      return (
        <li key={i} className="ml-4 list-disc text-sm">
          {formatInline(line.slice(2))}
        </li>
      );
    }
    // Handle bold
    if (line.trim()) {
      return (
        <p key={i} className="text-sm">
          {formatInline(line)}
        </p>
      );
    }
    return null;
  });
}

function formatInline(text: string) {
  // Bold text
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function BlendAnalysisView({ analysis, isStreaming }: BlendAnalysisViewProps) {
  const sections = parseAnalysisMarkdown(analysis.rawMarkdown);

  if (sections.length === 0 && analysis.rawMarkdown) {
    // Fallback: show raw markdown while streaming
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Blend Analysis
            {isStreaming && (
              <Badge variant="secondary" className="animate-pulse">
                Analyzing...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{analysis.rawMarkdown}</pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Blend Analysis
          </CardTitle>
          {analysis.classification && (
            <Badge className="bg-gradient-to-r from-primary to-primary/70">
              {analysis.classification}
            </Badge>
          )}
        </div>
        {analysis.score > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">Effectiveness:</span>
            <Progress value={analysis.score * 10} className="flex-1 h-2" />
            <span className="font-semibold text-primary">{analysis.score}/10</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={sections.map((_, i) => `section-${i}`)} className="space-y-2">
          {sections.map((section, index) => (
            <AccordionItem
              key={index}
              value={`section-${index}`}
              className={`border rounded-lg px-3 ${
                section.type === 'warning'
                  ? 'border-destructive/30 bg-destructive/5'
                  : section.type === 'success'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border'
              }`}
            >
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      section.type === 'warning'
                        ? 'text-destructive'
                        : section.type === 'success'
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    {section.icon}
                  </span>
                  <span className="font-medium text-sm">{section.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3">
                <div className="space-y-1">{formatContent(section.content)}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-xs text-muted-foreground text-center mt-4">
          ⚠️ Educational purposes only. Consult a healthcare provider.
        </p>
      </CardContent>
    </Card>
  );
}
