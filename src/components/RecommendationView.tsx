import { useMemo } from 'react';
import { Sun, Moon, Clock, Calendar, Check, AlertTriangle, Target, Lightbulb, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface RecommendationViewProps {
  content: string;
  isStreaming?: boolean;
}

interface ParsedSection {
  title: string;
  content: string;
  icon: React.ReactNode;
}

function parseMarkdownSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = markdown.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  const iconMap: Record<string, React.ReactNode> = {
    'summary': <Check className="h-4 w-4" />,
    'core stack': <Target className="h-4 w-4" />,
    'synergistic': <Lightbulb className="h-4 w-4" />,
    'plan schedule': <Calendar className="h-4 w-4" />,
    'expected': <TrendingUp className="h-4 w-4" />,
    'why this': <Target className="h-4 w-4" />,
    'safety': <AlertTriangle className="h-4 w-4" />,
    'how to': <Clock className="h-4 w-4" />,
  };

  const getIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerTitle.includes(key)) return icon;
    }
    return <Check className="h-4 w-4" />;
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
          icon: getIcon(currentTitle),
        });
      }
      currentTitle = line.replace('## ', '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
      icon: getIcon(currentTitle),
    });
  }

  return sections;
}

function renderContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inDayBlock = false;
  let dayBlockTitle = '';
  let dayBlockContent: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushDayBlock = () => {
    if (dayBlockTitle) {
      elements.push(
        <div key={`day-${elements.length}`} className="my-4 p-4 rounded-lg bg-accent/50 border border-border">
          <div className="flex items-center gap-2 mb-3">
            {dayBlockTitle.toLowerCase().includes('morning') && <Sun className="h-4 w-4 text-warning" />}
            {dayBlockTitle.toLowerCase().includes('evening') && <Moon className="h-4 w-4 text-primary" />}
            {dayBlockTitle.toLowerCase().includes('day a') && <Badge variant="outline">Day A</Badge>}
            {dayBlockTitle.toLowerCase().includes('day b') && <Badge variant="secondary">Day B</Badge>}
            <span className="font-medium">{dayBlockTitle}</span>
          </div>
          <div className="space-y-1 text-sm">
            {dayBlockContent.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
              </div>
            ))}
          </div>
        </div>
      );
      dayBlockTitle = '';
      dayBlockContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for day/time blocks
    if (trimmed.startsWith('### ') || trimmed.startsWith('**Day') || trimmed.startsWith('**Morning') || trimmed.startsWith('**Evening') || trimmed.startsWith('**Midday')) {
      flushList();
      flushDayBlock();
      inDayBlock = true;
      dayBlockTitle = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
      continue;
    }

    if (inDayBlock && trimmed.startsWith('- ')) {
      dayBlockContent.push(trimmed.slice(2));
      continue;
    }

    if (inDayBlock && trimmed === '') {
      flushDayBlock();
      inDayBlock = false;
      continue;
    }

    // Regular list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushDayBlock();
      inDayBlock = false;
      listItems.push(trimmed.slice(2));
      continue;
    }

    // Empty lines
    if (trimmed === '') {
      flushList();
      continue;
    }

    // Regular paragraphs
    flushList();
    flushDayBlock();
    inDayBlock = false;
    elements.push(
      <p 
        key={`p-${elements.length}`} 
        className="my-2 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
      />
    );
  }

  flushList();
  flushDayBlock();

  return elements;
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm font-mono">$1</code>');
}

export function RecommendationView({ content, isStreaming }: RecommendationViewProps) {
  const sections = useMemo(() => parseMarkdownSections(content), [content]);

  if (!content) return null;

  // If streaming or no sections parsed, show raw formatted content
  if (isStreaming || sections.length === 0) {
    return (
      <div className="prose prose-sm max-w-none">
        <div className="space-y-2 text-sm animate-fade-in">
          {renderContent(content)}
        </div>
      </div>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={sections.map((_, i) => `section-${i}`)} className="space-y-2">
      {sections.map((section, index) => (
        <AccordionItem 
          key={index} 
          value={`section-${index}`}
          className="border rounded-lg px-4 bg-card"
        >
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <span className="text-primary">{section.icon}</span>
              <span className="font-medium text-sm">{section.title}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="text-sm space-y-1">
              {renderContent(section.content)}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
