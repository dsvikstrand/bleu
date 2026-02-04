import OpenAI from 'openai';
import { z } from 'zod';
import type {
  BannerRequest,
  BannerResult,
  BlueprintAnalysisRequest,
  InventoryRequest,
  InventorySchema,
  LLMClient,
} from './types';
import {
  BLUEPRINT_SYSTEM_PROMPT,
  INVENTORY_SYSTEM_PROMPT,
  buildBlueprintUserPrompt,
  buildInventoryUserPrompt,
  extractJson,
} from './prompts';

const InventorySchemaValidator = z.object({
  summary: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(z.string()),
    })
  ),
  suggestedTags: z.array(z.string()).optional(),
});

export function createOpenAIClient(): LLMClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const imageSize = process.env.OPENAI_IMAGE_SIZE || '1536x1024';
  const imageQuality = process.env.OPENAI_IMAGE_QUALITY || 'low';
  const client = new OpenAI({ apiKey });

  return {
    async generateInventory(input: InventoryRequest): Promise<InventorySchema> {
      const response = await client.responses.create({
        model,
        instructions: INVENTORY_SYSTEM_PROMPT,
        input: buildInventoryUserPrompt(input),
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new Error('No output text from OpenAI');
      }

      const parsed = JSON.parse(extractJson(outputText));
      return InventorySchemaValidator.parse(parsed);
    },
    async analyzeBlueprint(input: BlueprintAnalysisRequest): Promise<string> {
      const response = await client.responses.create({
        model,
        instructions: BLUEPRINT_SYSTEM_PROMPT,
        input: buildBlueprintUserPrompt(input),
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new Error('No output text from OpenAI');
      }

      return outputText;
    },
    async generateBanner(input: BannerRequest): Promise<BannerResult> {
      const prompt = buildBannerPrompt(input);
      const response = await client.images.generate({
        model: imageModel,
        prompt,
        size: imageSize,
        quality: imageQuality,
        response_format: 'b64_json',
      });

      const base64 = response.data?.[0]?.b64_json;
      if (!base64) {
        throw new Error('No image data returned');
      }

      return {
        buffer: Buffer.from(base64, 'base64'),
        mimeType: 'image/png',
        prompt,
      };
    },
  };
}

function buildBannerPrompt(input: BannerRequest) {
  const title = input.title.trim();
  const inventoryTitle = input.inventoryTitle?.trim();
  const tags = (input.tags || [])
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  const parts = [
    `A clean, modern banner image for a community blueprint titled "${title}".`,
  ];

  if (inventoryTitle) {
    parts.push(`Based on the inventory "${inventoryTitle}".`);
  }

  if (tags.length > 0) {
    parts.push(`Theme keywords: ${tags.join(', ')}.`);
  }

  parts.push(
    'Wide landscape composition, minimal, tasteful gradients, soft lighting, no text, no logos, no watermarks.'
  );

  return parts.join(' ');
}
