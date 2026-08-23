import { vi } from 'vitest';
import { createApp } from "../src/server.js";
import { requestContext } from "../src/context/request-context.js";

describe('Request lifecycle order', () => {
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

    it('runs middleware -> guard -> interceptor:before -> pipe -> handler -> interceptor:after, in that exact order', async () => {
        const markSpy = vi.spyOn(requestContext, 'mark');

        const response = await fetch(`${baseUrl}/users/42`, {
            headers: { Authorization: 'Bearer test-token' },
        });
        expect(response.status).toBe(200);

        expect(markSpy.mock.calls.map(call => call[0])).toEqual([
            'middleware',
            'guard',
            'interceptor:before',
            'pipe',
            'handler',
            'interceptor:after',
        ]);

        markSpy.mockRestore();
    })

    it('stops at the guard when Authorization is missing — pipe/handler never mark', async () => {
        const markSpy = vi.spyOn(requestContext, 'mark');

        const response = await fetch(`${baseUrl}/users/42`);
        expect(response.status).toBe(403);

        expect(markSpy.mock.calls.map(call => call[0])).toEqual(['middleware', 'guard']);

        markSpy.mockRestore();
    })

    it('stops before the lifecycle stages when the route itself is not found', async () => {
        const markSpy = vi.spyOn(requestContext, 'mark');

        const response = await fetch(`${baseUrl}/nope`);
        expect(response.status).toBe(404);

        expect(markSpy.mock.calls).toEqual([]);

        markSpy.mockRestore();
    })
})
