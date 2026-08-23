import { vi } from 'vitest';
import { createApp } from "../src/server.js";
import { Container } from "../src/container.js";
import { UserController } from "../src/controllers/user.controller.js";
import { UserService } from "../src/services/user.service.js";
import { CreateUserDto } from "../src/dto/create-user.dto.js";

const AUTH = { Authorization: 'Bearer test-token' };

describe('HTTP', () => {
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

    it('GET /users/42 — the route is found through the controller prefix', async () => {
        const response = await fetch(`${baseUrl}/users/42`, { headers: AUTH });

        expect(response.status).toBe(200);
    })

    it('GET /users/42 — @Param arrives as an argument', async () => {
        const response = await fetch(`${baseUrl}/users/42`, { headers: AUTH });
        const body = await response.json();

        expect(body.id).toBe('42');
    })

    it('GET /users?limit=5 — @Query arrives as a separate argument', async () => {
        const spy = vi.spyOn(UserController.prototype, 'listUsers');

        const response = await fetch(`${baseUrl}/users?limit=5`, { headers: AUTH });

        expect(response.status).toBe(200);
        expect(spy.mock.calls.at(-1)).toEqual(['5']);

        spy.mockRestore();
    })

    it('GET /nope — an unknown route answers 404 even without auth (route lookup runs before the guard)', async () => {
        const response = await fetch(`${baseUrl}/nope`);

        expect(response.status).toBe(404);
    })

    it('POST /users — @Body arrives as the Zod-parsed CreateUserDto, not the raw JSON', async () => {
        const spy = vi.spyOn(UserController.prototype, 'createUser');

        const response = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            headers: {...AUTH, 'Content-Type': 'application/json'},
            body: JSON.stringify({email: 'dto@example.com', role: 'admin'}),
        });

        expect(response.status).toBe(201);

        const [receivedBody] = spy.mock.calls.at(-1)!;
        const dto = receivedBody as CreateUserDto;

        expect(dto).toEqual({email: 'dto@example.com'});
        expect('role' in dto).toBe(false);

        spy.mockRestore();
    })

    it('POST /users with {"email":"not-an-email"} — 400 listing the email field', async () => {
        const response = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            headers: {...AUTH, 'Content-Type': 'application/json'},
            body: JSON.stringify({email: 'not-an-email'}),
        });

        expect(response.status).toBe(400);

        const text = await response.text();
        expect(text).toMatch(/email/);
    })
})

describe('AuthGuard', () => {
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

    it('rejects a request with no Authorization header with 403', async () => {
        const response = await fetch(`${baseUrl}/users/42`);

        expect(response.status).toBe(403);
    })

    it('never calls the handler when the guard rejects the request', async () => {
        const spy = vi.spyOn(UserController.prototype, 'getUser');

        await fetch(`${baseUrl}/users/42`);

        expect(spy).not.toHaveBeenCalled();

        spy.mockRestore();
    })

    it('lets the request through once Authorization is present', async () => {
        const response = await fetch(`${baseUrl}/users/42`, { headers: AUTH });

        expect(response.status).toBe(200);
    })

    it('GET /users — no @UseGuards anywhere on this route, so it stays public', async () => {
        const response = await fetch(`${baseUrl}/users`);

        expect(response.status).toBe(200);
    })

    it('POST /users — its own @UseGuards(AuthGuard) still requires Authorization', async () => {
        const response = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@b.com' }),
        });

        expect(response.status).toBe(403);
    })
})

describe('LoggingInterceptor', () => {
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

    it('logs the method, path, and duration for a real request', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const response = await fetch(`${baseUrl}/users/42`, { headers: AUTH });
        expect(response.status).toBe(200);

        const lines = logSpy.mock.calls.map(call => call[0]);
        expect(lines).toEqual(
            expect.arrayContaining([expect.stringMatching(/^GET \/users\/42 — [0-9]+(\.[0-9]+)? ?ms$/)])
        );

        logSpy.mockRestore();
    })
})

describe('ExceptionFilter', () => {
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

    it('turns an unexpected thrown Error into 500 without leaking its message or a stack trace', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const spy = vi.spyOn(UserController.prototype, 'getUser').mockImplementation(() => {
            throw new Error('boom');
        });

        const response = await fetch(`${baseUrl}/users/42`, { headers: AUTH });
        expect(response.status).toBe(500);

        const text = await response.text();
        expect(text).not.toMatch(/boom|at .*\.ts:/);

        spy.mockRestore();
        errorSpy.mockRestore();
    })

    it('maps NotFoundError to 404 with a message naming the actual route, not a generic string', async () => {
        const response = await fetch(`${baseUrl}/nope`);

        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body.error).toMatch(/GET.*\/nope/);
    })
})

describe('Container wiring', () => {
    it('builds the controller through the container, injecting the service', () => {
        const container = new Container();

        const service = container.resolve(UserService);
        const controller = container.resolve(UserController);

        expect(controller).toBeInstanceOf(UserController);
        expect((controller as any).userService).toBe(service);
    })

    it('keeps the controller itself a singleton', () => {
        const container = new Container();

        expect(container.resolve(UserController)).toBe(container.resolve(UserController));
    })
})
