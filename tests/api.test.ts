import { afterEach, expect, test, vi } from 'vitest'
import { authorizeGitHub, checkHealth, approveAndMergePR } from '../src/api'
afterEach(() => vi.unstubAllGlobals())
test('health errors are surfaced', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', {status:503})))
  await expect(checkHealth()).rejects.toThrow('503')
})
test('authorization includes credentials and no browser storage', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',user:{},repos:[]})))
  vi.stubGlobal('fetch', fetch)
  await authorizeGitHub('test-only-token', 'owner')
  expect(fetch.mock.calls[0][1].credentials).toBe('include')
  expect(localStorage.length).toBe(0)
})
test('failed merge remains a failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Verification required', {status:409})))
  await expect(approveAndMergePR('owner/repo',1)).rejects.toThrow('409')
})
