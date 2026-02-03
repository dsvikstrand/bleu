import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlendRecipe } from '@/types/stacklab';
import { History, Trash2, Copy, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BlendHistoryProps {
  history: BlendRecipe[];
  onLoad: (blendId: string) => void;
  onDelete: (blendId: string) => void;
}

export function BlendHistory({ history, onLoad, onDelete }: BlendHistoryProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Blend History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Your analyzed blends will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Blend History
          <Badge variant="secondary" className="ml-auto">
            {history.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="p-4 space-y-2">
            {history.map((blend) => (
              <div
                key={blend.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{blend.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {blend.items.length} ingredients •{' '}
                      {formatDistanceToNow(new Date(blend.createdAt), { addSuffix: true })}
                    </p>
                    {blend.analysis?.classification && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {blend.analysis.classification}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onLoad(blend.id)}
                      title="Use as template"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => onDelete(blend.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
