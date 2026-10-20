import type { Env } from '../types';

const encoder = new TextEncoder();
async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function flowSignature(parameters: Record<string, string | number>, secret: string) {
  const serialized = Object.keys(parameters).sort().map((key) => `${key}${parameters[key]}`).join('');
  return sha256(`${serialized}${secret}`);
}

export async function createFlowPayment(env: Env, input: { orderNumber: string; amount: number; email: string }) {
  if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY || !env.FLOW_RETURN_URL || !env.FLOW_CONFIRMATION_URL) throw new Error('FLOW_NOT_CONFIGURED');
  const params = {
    apiKey: env.FLOW_API_KEY, commerceOrder: input.orderNumber, subject: `Pedido ${input.orderNumber}`,
    currency: 'CLP', amount: input.amount, email: input.email, urlReturn: env.FLOW_RETURN_URL, urlConfirmation: env.FLOW_CONFIRMATION_URL,
  };
  const body = new URLSearchParams(Object.entries({ ...params, s: await flowSignature(params, env.FLOW_SECRET_KEY) }).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`${env.FLOW_BASE_URL ?? 'https://sandbox.flow.cl/api'}/payment/create`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error(`FLOW_CREATE_FAILED:${response.status}`);
  return response.json<{ url: string; token: string }>();
}

export async function getFlowPaymentStatus(env: Env, token: string) {
  if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY) throw new Error('FLOW_NOT_CONFIGURED');
  const params = { apiKey: env.FLOW_API_KEY, token };
  const query = new URLSearchParams(Object.entries({ ...params, s: await flowSignature(params, env.FLOW_SECRET_KEY) }).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`${env.FLOW_BASE_URL ?? 'https://sandbox.flow.cl/api'}/payment/getStatus?${query}`);
  if (!response.ok) throw new Error(`FLOW_STATUS_FAILED:${response.status}`);
  return response.json<{ flowOrder: number; commerceOrder: string; status: number; amount: number }>();
}
