/**
 * Server-only 0G Compute inference with broker authentication.
 *
 * This file imports @0glabs/0g-serving-broker (Node.js only).
 * It must NEVER be imported by Next.js pages/components — only by
 * background job scripts (run-jobs.ts, matchLifecycleJobs.ts).
 */

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { Wallet, JsonRpcProvider } from 'ethers';

// ─── Environment ──────────────────────────────────────────

function getEnv(key: string): string {
  return process.env[key] || '';
}

// ─── Helpers ──────────────────────────────────────────────

function extractJSON(raw: string): any {
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const start = stripped.search(/[{\[]/);
  if (start === -1) throw new Error('No JSON found in model output');

  const openChar = stripped[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === openChar) depth++;
    else if (stripped[i] === closeChar) depth--;
    if (depth === 0) {
      return JSON.parse(stripped.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model output');
}

// ─── Broker singleton ─────────────────────────────────────

let _broker: any = null;
let _brokerInitPromise: Promise<any> | null = null;

async function getBroker() {
  if (_broker) return _broker;
  if (_brokerInitPromise) return _brokerInitPromise;

  _brokerInitPromise = (async () => {
    const privateKey = getEnv('PRIVATE_KEY') || getEnv('OG_PRIVATE_KEY');
    const rpcUrl = getEnv('OG_RPC_URL') || 'https://evmrpc-testnet.0g.ai';

    if (!privateKey) {
      throw new Error('[0gServer] No PRIVATE_KEY or OG_PRIVATE_KEY set');
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    _broker = await createZGComputeNetworkBroker(signer);
    return _broker;
  })();

  return _brokerInitPromise;
}

// ─── Server-side inferJSON with broker auth ───────────────

export interface InferJSONParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function inferJSON<T = any>(params: InferJSONParams): Promise<T> {
  const {
    systemPrompt,
    userPrompt,
    model = 'qwen/qwen-2.5-7b-instruct',
    temperature = 0.2,
    maxTokens = 900,
  } = params;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  let rawContent: string;

  try {
    rawContent = await callWithBrokerAuth(body);
  } catch (networkErr) {
    console.error('[0gServer] inference call failed:', networkErr);
    throw networkErr;
  }

  // Attempt 1: parse JSON
  try {
    return extractJSON(rawContent) as T;
  } catch {
    console.warn('[0gServer] JSON parse failed, retrying...');
    const retryMessages = [
      ...messages,
      { role: 'assistant' as const, content: rawContent },
      {
        role: 'user' as const,
        content:
          'Your previous reply was not valid JSON. Please return ONLY a valid JSON object matching the requested schema, with no markdown fences or extra text.',
      },
    ];
    const retryBody = { ...body, messages: retryMessages };
    const retryContent = await callWithBrokerAuth(retryBody);
    return extractJSON(retryContent) as T;
  }
}

// ─── Authenticated inference call ─────────────────────────

async function callWithBrokerAuth(body: Record<string, any>): Promise<string> {
  const providerAddress = getEnv('OG_PROVIDER_ADDRESS');
  const serviceUrl = getEnv('NEXT_PUBLIC_0G_ENDPOINT') || getEnv('OG_ENDPOINT');

  if (!serviceUrl) {
    throw new Error('[0gServer] No service URL. Set NEXT_PUBLIC_0G_ENDPOINT.');
  }
  if (!providerAddress) {
    throw new Error('[0gServer] No OG_PROVIDER_ADDRESS set.');
  }

  const broker = await getBroker();

  // Get auth headers from broker
  const content = JSON.stringify(body);
  const authHeaders = await broker.inference.getRequestHeaders(
    providerAddress,
    content
  );

  const url = serviceUrl.replace(/\/+$/, '') + '/v1/proxy/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: content,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[0gServer] HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const responseContent = data?.choices?.[0]?.message?.content;

  if (!responseContent) {
    throw new Error('[0gServer] Empty response from model');
  }

  // Process billing
  try {
    const chatId = data?.id || '';
    const usage = data?.usage?.total_tokens || 0;
    await broker.inference.processResponse(providerAddress, usage, chatId);
  } catch {
    // Non-fatal
  }

  return responseContent;
}
