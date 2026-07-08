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
    const systemPrompt = `You are a regulatory cost analyst for upstream oil and gas PSC supervision. 
Your task is to write a formal cost review narrative based on structured JSON benchmarking data.

Write exactly 4 sentences. Use all numerical values exactly as they appear in the JSON — do not round, summarize, or approximate them.

Follow this structure precisely:

Sentence 1: State the total forecasted cost, the approved baseline, the absolute variance in dollars, the percentage deviation, and the severity level.
Sentence 2: Name the dominant cost driver, state its absolute variance in dollars, its percentage deviation from its own baseline, its contribution ratio to total aggregate variance, and its historical classification.
Sentence 3: List every non-dominant cost component by name with its percentage deviation in parentheses, and state whether they require escalation.
Sentence 4: State the regulatory recommendation based on the severity level.

Here is an example of the exact style and detail level required:

"Total proposed cost of $59,794,395 exceeds the approved baseline of $56,723,100, reflecting an aggregate deviation of $3,071,295 or 5.41% at a LOW severity level. Pipeline Costs is identified as the dominant cost driver with a variance of $1,247,274 or 8.50% above its baseline, contributing 40.61% of the total aggregate deviation, though remaining within the normal historical range. All other cost components, namely Substructure Cost (+4.20%), Deck Structure Cost (+4.20%), Production Facilities Cost (+5.00%), General Support Cost (+3.50%), and Certifications and Permits Costs (+2.00%), show reasonable deviations and do not require escalation action. The regulator is advised to request written justification from the contractor regarding the Pipeline Costs increase given its dominant contribution to total variance, though a comprehensive review is not required at this stage."

Now write the narrative for the JSON data provided. Match this style exactly. Do not shorten, summarize, or omit any values.`;
const userMessage = `Generate a regulatory cost review narrative for the following benchmarking findings. 
Your response must be 4 sentences and must include every dollar amount and percentage from the data below. 
Do not summarize or approximate.\n\n${JSON.stringify(vedaJson, null, 2)}`;
    const response: any = await $fetch(`${ollamaBase}/v1/chat/completions`, {
      method: 'POST',
      timeout: 120_000,
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
        max_tokens: 4000,
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
        narrative: narrativeText
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

  const tokens = text.match(/\b\d+(?:,\d+)*(?:\.\d+)?%?\b/g) || [];
  const whitelist = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 100, 200]);

  for (const token of tokens) {
    const cleanToken = token.replace(/[%,]/g, '');
    const numVal = parseFloat(cleanToken);

    if (isNaN(numVal)) continue;
    if (whitelist.has(numVal)) continue;

    let found = false;
    for (const jsonNum of jsonNumbers) {
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