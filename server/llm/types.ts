export interface InventoryRequest {
  keywords: string;
  title?: string;
  customInstructions?: string;
  preferredCategories?: string[];
}

export interface InventorySchema {
  summary: string;
  categories: Array<{ name: string; items: string[] }>;
  suggestedTags?: string[];
}

export interface BlueprintSelectedItem {
  name: string;
  context?: string;
}

export interface BlueprintAnalysisRequest {
  title: string;
  inventoryTitle: string;
  selectedItems: Record<string, BlueprintSelectedItem[]>;
  mixNotes?: string;
  reviewPrompt?: string;
  reviewSections?: string[];
  includeScore?: boolean;
}

export interface BannerRequest {
  title: string;
  inventoryTitle?: string;
  tags?: string[];
}

export interface BannerResult {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
}

export interface BlueprintGenerationRequest {
  title?: string;
  description?: string;
  notes?: string;
  inventoryTitle: string;
  categories: Array<{ name: string; items: string[] }>;
}

export interface BlueprintStepItem {
  category: string;
  name: string;
  context?: string;
}

export interface BlueprintStep {
  title: string;
  description?: string;
  items: BlueprintStepItem[];
}

export interface BlueprintGenerationResult {
  title: string;
  steps: BlueprintStep[];
}

export interface YouTubeDraftStep {
  name: string;
  notes: string;
  timestamp?: string | null;
}

export interface YouTubeBlueprintRequest {
  videoUrl: string;
  transcript: string;
  additionalInstructions?: string;
}

export interface YouTubeBlueprintResult {
  title: string;
  description: string;
  steps: YouTubeDraftStep[];
  notes?: string | null;
  tags?: string[];
}

export interface LLMClient {
  generateInventory(input: InventoryRequest): Promise<InventorySchema>;
  analyzeBlueprint(input: BlueprintAnalysisRequest): Promise<string>;
  generateBanner(input: BannerRequest): Promise<BannerResult>;
  generateBlueprint(input: BlueprintGenerationRequest): Promise<BlueprintGenerationResult>;
  generateYouTubeBlueprint(input: YouTubeBlueprintRequest): Promise<YouTubeBlueprintResult>;
}
