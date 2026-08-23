import { vi } from 'vitest';
import { createApp } from "../src/server.js";

const AUTH = { Authorization: 'Bearer test-token' };

describe('AsyncLocalStorage request context', () => {
    let server: ReturnType<typeof createApp>;
    let baseUrl: string;

    beforeAll(async () => {
        server = createApp();

        await new Promise<void>((resolve) => {
            server.listen(0, resolve)
        })

        const address = server.address();

        if (!address || typeof address === 'string') {
            throw new Error('Server is not listening');
        }

        baseUrl = `http://localhost:${address.port}`;
    })

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()))
        })
    })

    it('tags the response with a generated X-Request-Id when the client sends none', async () => {
        const response = await fetch(`${baseUrl}/users/1`, { headers: AUTH });

        expect(response.headers.get('x-request-id')).toBeTruthy();
    })

    it('echoes back a client-supplied X-Request-Id instead of generating a new one', async () => {
        const response = await fetch(`${baseUrl}/users/1`, {
            headers: { ...AUTH, 'x-request-id': 'client-chosen-id' },
        });

        expect(response.headers.get('x-request-id')).toBe('client-chosen-id');
    })

    it('lets a service two calls deep print the same requestId, with no id parameter in its signature', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const response = await fetch(`${baseUrl}/users/1`, {
            headers: { ...AUTH, 'x-request-id': 'trace-me' },
        });
        expect(response.headers.get('x-request-id')).toBe('trace-me');

        const lines = logSpy.mock.calls.map(call => call[0]);
        expect(lines).toEqual(
            expect.arrayContaining([expect.stringMatching(/^\[trace-me] UserService\.findOne\(1\)$/)])
        );

        logSpy.mockRestore();
    })

    it('keeps 10 concurrent requests from leaking requestId into each other\'s response', async () => {
        const ids = Array.from({ length: 10 }, (_, i) => `concurrent-${i}`);

        const responses = await Promise.all(
            ids.map(id => fetch(`${baseUrl}/users/1`, {
                headers: { ...AUTH, 'x-request-id': id },
            }))
        );

        const echoedIds = responses.map(r => r.headers.get('x-request-id'));

        expect(echoedIds).toEqual(ids);
    })

    it('keeps 10 concurrent auto-generated requestIds all distinct', async () => {
        const responses = await Promise.all(
            Array.from({ length: 10 }, () => fetch(`${baseUrl}/users/1`, { headers: AUTH }))
        );

        const ids = responses.map(r => r.headers.get('x-request-id'));

        expect(new Set(ids).size).toBe(10);
    })
})
