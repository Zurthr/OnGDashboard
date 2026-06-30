import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const vedaJson = body?.vedaJson;

  if (!vedaJson) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing VEDA JSON data in request body.'
    });
  }

  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  const ollamaBase = (process.env.OLLAMA_BASE_URL || 'https://ollama.defendercf.com').replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL || 'gemma4:e4b';

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Cloudflare Access tokens are not configured in .env file.'
    });
  }

  try {
    const systemPrompt = `You are a regulatory cost analyst assistant for upstream oil and gas PSC supervision. 
You receive a structured JSON object containing cost benchmarking findings and produce 
a formal analytical narrative for regulatory review.

STRICT RULES:
- You may only reference numerical values that exist in the JSON payload
- Do not introduce any figures, percentages, or claims not present in the input
- Do not speculate about causes of cost deviations
- Write in formal regulatory English
- Structure your output as: (1) Summary of overall deviation, (2) Dominant driver analysis, 
  (3) Component breakdown, (4) Review recommendation
- Maximum 200 words`;

    const userMessage = `Generate a regulatory cost review narrative for the following benchmarking findings:\n${JSON.stringify(vedaJson, null, 2)}`;

    // Call Ollama OpenAI-compatible API behind Cloudflare Zero Trust
    const response: any = await $fetch(`${ollamaBase}/v1/chat/completions`, {
      method: 'POST',
      timeout: 120_000, // 120s — Ollama LLM generation can be slow
      headers: {
        'CF-Access-Client-Id': clientId,
        'CF-Access-Client-Secret': clientSecret,
        'Content-Type': 'application/json'
      },
      body: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }
    });

    const narrativeText = response?.choices?.[0]?.message?.content || '';

    if (!narrativeText) {
      throw new Error('Received empty response content from Ollama API.');
    }

    // ─── BFF Verification Step ───
    const verified = verifyNarrative(narrativeText, vedaJson);

    if (!verified) {
      return {
        success: false,
        verified: false,
        message: 'Narrative verification failed — numerical inconsistency detected. Please regenerate.',
        narrative: narrativeText // Return for debugging/logging
      };
    }

    return {
      success: true,
      verified: true,
      narrative: narrativeText
    };

  } catch (error: any) {
    console.error('Error generating narrative:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Narrative generation failed: ${error.message || error}`
    });
  }
});

/**
 * Normalizes and extracts numbers from VEDA JSON, then compares with text numerical tokens
 */
function verifyNarrative(text: string, json: any): boolean {
  const jsonNumbers = new Set<number>();

  function collect(obj: any) {
    if (typeof obj === 'number') {
      jsonNumbers.add(obj);
      // Add rounded representation
      jsonNumbers.add(Math.round(obj));
    } else if (typeof obj === 'string') {
      const clean = obj.replace(/[$,%]/g, '').trim();
      const num = Number(clean);
      if (!isNaN(num) && clean !== '') {
        jsonNumbers.add(num);
        jsonNumbers.add(Math.round(num));
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(collect);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(collect);
    }
  }

  collect(json);

  // Extract all numerical tokens from the narrative text
  // Match standard numbers, decimals, percentages, currency
  const tokens = text.match(/\b\d+(?:,\d+)*(?:\.\d+)?%?\b/g) || [];

  // Whitelist structural or rule constraint numbers
  const whitelist = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 100, 200]);

  for (const token of tokens) {
    const cleanToken = token.replace(/[%,]/g, '');
    const numVal = parseFloat(cleanToken);

    if (isNaN(numVal)) continue;
    if (whitelist.has(numVal)) continue;

    // Check if the number matches any value in the JSON payload
    let found = false;
    for (const jsonNum of jsonNumbers) {
      // Direct comparison or close matching (within a delta of 0.1 to account for minor rounding)
      if (jsonNum === numVal || Math.abs(jsonNum - numVal) < 0.1) {
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn(`BFF Verification: Narrative value ${token} (${numVal}) is not present in VEDA JSON. Rejecting.`);
      return false;
    }
  }

  return true;
}
