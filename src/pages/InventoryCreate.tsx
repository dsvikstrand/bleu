import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/shared/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TagInput } from '@/components/shared/TagInput';
import { useCreateInventory } from '@/hooks/useInventories';
import { useToast } from '@/hooks/use-toast';
import { useTagSuggestions } from '@/hooks/useTags';
import { useRecentTags } from '@/hooks/useRecentTags';
import type { Json } from '@/integrations/supabase/types';

function buildSchema(promptInventory: string, promptCategories: string): Json {
  const categories = promptCategories
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((name) => ({ name, items: [] as string[] }));

  return {
    summary: promptInventory.trim(),
    categories,
  };
}

export default function InventoryCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createInventory = useCreateInventory();
  const { data: tagSuggestions } = useTagSuggestions();
  const { recentTags, addRecentTags } = useRecentTags();

  const [title, setTitle] = useState('');
  const [promptInventory, setPromptInventory] = useState('');
  const [promptCategories, setPromptCategories] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  const previewCategories = useMemo(() => {
    return promptCategories
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, [promptCategories]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Add a title before creating the inventory.',
        variant: 'destructive',
      });
      return;
    }

    if (!promptInventory.trim() || !promptCategories.trim()) {
      toast({
        title: 'Prompts required',
        description: 'Fill out the inventory prompts before continuing.',
        variant: 'destructive',
      });
      return;
    }

    if (tags.length === 0) {
      toast({
        title: 'Tags required',
        description: 'Add at least one tag to help discovery.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const schema = buildSchema(promptInventory, promptCategories);
      const inventory = await createInventory.mutateAsync({
        title: title.trim(),
        promptInventory: promptInventory.trim(),
        promptCategories: promptCategories.trim(),
        generatedSchema: schema,
        tags,
        isPublic,
      });

      addRecentTags(tags);
      navigate(`/inventory/${inventory.id}`);
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold">Create Inventory</h1>
          <p className="text-muted-foreground">
            Inventories are the reusable base for blueprints.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Inventory details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inventory-title">Title</Label>
              <Input
                id="inventory-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Skincare Starter Kit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-prompt">What should your inventory contain?</Label>
              <Textarea
                id="inventory-prompt"
                value={promptInventory}
                onChange={(event) => setPromptInventory(event.target.value)}
                placeholder="Tools, ingredients, and steps needed for a skincare routine."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-categories">Give a few categories this inventory should contain</Label>
              <Textarea
                id="inventory-categories"
                value={promptCategories}
                onChange={(event) => setPromptCategories(event.target.value)}
                placeholder="Cleansers, serums, moisturizers, SPF"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recentTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]).slice(0, 4))}
                  >
                    #{tag}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tags (max 4)</Label>
              <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions || []} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="font-medium">Public inventory</p>
                <p className="text-sm text-muted-foreground">Public inventories appear in search.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-generated preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Categories will be generated from your prompts.
            </p>
            <div className="flex flex-wrap gap-2">
              {previewCategories.length > 0 ? (
                previewCategories.map((category) => (
                  <Badge key={category} variant="secondary">{category}</Badge>
                ))
              ) : (
                <Badge variant="outline">Add categories to preview</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={createInventory.isPending}
          className="w-full"
        >
          Create Inventory
        </Button>
      </main>
    </div>
  );
}
