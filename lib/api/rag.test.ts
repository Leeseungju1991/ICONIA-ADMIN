import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ragApi, type RagSource, type RagChunk, type RagQueryData } from './rag';

function envelopeResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ ok: status >= 200 && status < 300, data, error: status >= 400 ? { code: 'ERR_X', message: 'boom' } : null, meta: { request_id: 'r1', server_time: 't', api_version: 'v1' } }),
    text: async () => JSON.stringify({ ok: status >= 200 && status < 300, data, error: null, meta: {} }),
  } as unknown as Response;
}
function failResponse(code = 'ERR_RAG_UPSTREAM', message = 'upstream', status = 502) {
  return {
    ok: false,
    status,
    json: async () => ({ ok: false, data: null, error: { code, message, retryable: status >= 500 }, meta: {} }),
    text: async () => JSON.stringify({ ok: false, error: { code, message } }),
  } as unknown as Response;
}

describe('ragApi', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('listSources: GET /api/v1/admin/rag/sources, returns unwrapped array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse([{ id: 'manual', title: '제품 매뉴얼', chunks: 3, updated_at: '2026-01-01T00:00:00.000Z' }]));
    vi.stubGlobal('fetch', fetchMock);
    const data = await ragApi.listSources();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe('manual');
    expect(data[0].updated_at).toBe('2026-01-01T00:00:00.000Z');
    // @ts-expect-error — updatedAt must not exist (snake_case only)
    expect(data[0].updatedAt).toBeUndefined();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/v1\/admin\/rag\/sources$/);
    expect((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
  });

  it('getChunks: GET .../sources/:id/chunks?limit=N, url-encodes id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse([{ id: 'manual#0', text: '본문' }]));
    vi.stubGlobal('fetch', fetchMock);
    const data = await ragApi.getChunks('manual v1', 5);
    expect(data[0].id).toBe('manual#0');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/v1\/admin\/rag\/sources\/manual%20v1\/chunks\?limit=5$/);
  });

  it('getChunks: default limit 20', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    await ragApi.getChunks('manual');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/limit=20$/);
  });

  it('testQuery: POST .../test-query with snake_case body, returns unwrapped data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse({ answer: '답변', citations: [{ source_id: 'manual#0', text: '본문', score: 0.9 }], backend: 'mock', latency_ms: 12 }));
    vi.stubGlobal('fetch', fetchMock);
    const data = await ragApi.testQuery({ question: '보증?', backendOverride: 'bedrock', topK: 3 });
    expect(data.answer).toBe('답변');
    expect(data.backend).toBe('mock');
    expect(data.latency_ms).toBe(12);
    expect(data.citations[0].source_id).toBe('manual#0');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/v1\/admin\/rag\/test-query$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.question).toBe('보증?');
    expect(body.backend_override).toBe('bedrock'); // snake_case in the body
    expect(body.top_k).toBe(3);
  });

  it('testQuery: omits backend_override / top_k when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse({ answer: 'a', citations: [], backend: 'mock', latency_ms: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    await ragApi.testQuery({ question: 'q' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect('backend_override' in body).toBe(false);
    expect('top_k' in body).toBe(false);
  });

  it('throws on ok:false envelope (carries code)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failResponse('ERR_RAG_VALIDATION', 'bad', 400)));
    await expect(ragApi.testQuery({ question: 'q' })).rejects.toThrow(/ERR_RAG_VALIDATION|bad|400/);
  });

  it('throws on non-2xx with non-envelope body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json'); }, text: async () => 'plain error' } as unknown as Response));
    await expect(ragApi.listSources()).rejects.toThrow(/500|plain error/);
  });

  it('sends credentials: include (cookie-based admin session)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelopeResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    await ragApi.listSources();
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('include');
  });
});
