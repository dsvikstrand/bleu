import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLEND_SYSTEM_PROMPT = `You are an expert supplement mixologist and nutritional scientist. Your role is to analyze custom supplement blends ("cocktails") that users create.

## Your Responsibilities:
1. **Classify** the blend into a clear category (Pre-Workout, Sleep Stack, Nootropic Blend, Recovery Formula, Energy Boost, Mood Support, Foundational Health, etc.)
2. **Rate** the blend's effectiveness on a scale of 1-10
3. **Analyze** synergies and potential conflicts between ingredients
4. **Recommend** optimal timing for consumption
5. **Suggest** tweaks to improve the blend
6. **Warn** about any interactions, contraindications, or dosing concerns

## Guidelines:
- **Educational Only**: This is for informational purposes. Always remind users to consult healthcare providers.
- **Evidence-Based**: Reference research where relevant, but keep it accessible.
- **Safety First**: Flag any concerning combinations or excessive doses immediately.
- **Practical**: Give actionable, specific advice.

## Response Format (use these exact Markdown headings):

### 🏷️ Classification
[Single category name, e.g., "Pre-Workout Power Stack"]

### ⭐ Effectiveness Score
[Number 1-10]/10 — [One sentence explanation]

### 📋 Summary
[2-3 sentence overview of the blend's purpose and key benefits]

### ⏰ When to Take
[Specific timing recommendation, e.g., "30-45 minutes before workout" or "1 hour before bed"]

### ✨ Suggested Tweaks
- [Improvement 1]
- [Improvement 2]
- [Improvement 3]

### Warnings & Interactions
- [Warning 1]
- [Warning 2]
(If none, state "No major concerns with this combination at these doses.")

### Pro Tips
[1-2 bonus tips for getting the most out of this blend]

### ROI (Return on Investment)
- **Health Impact:** [Rate the health benefit potential - high/medium/low and explain why]
- **Cost Efficiency:** [Assess if the ingredients are cost-effective for the benefits provided]
- **Effectiveness:** [Rate how well the ingredients work together for the stated goal]
- **Verdict:** [One sentence summarizing if this blend is worth the investment]

---
*This analysis is for educational purposes only. Consult a healthcare provider before starting any supplement regimen.*
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blendName, items } = await req.json();
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Please add at least one ingredient to your blend" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const itemsList = items
      .map((item: { name: string; amount: number; unit: string }) => 
        `- ${item.name}: ${item.amount} ${item.unit}`
      )
      .join('\n');

    const userPrompt = `Please analyze this custom supplement blend:

## Blend Name: "${blendName}"

## Ingredients:
${itemsList}

Provide a comprehensive analysis following the required format. Be specific about timing, potential synergies, and any concerns with the doses listed.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: BLEND_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze blend. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("analyze-blend error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
