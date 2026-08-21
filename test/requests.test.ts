import { vi } from 'vitest';
import { createApp } from "../src/server.js";
import { Container } from "../src/container.js";
import { UserController } from "../src/controllers/user.controller.js";
import { UserService } from "../src/services/user.service.js";
import { CreateUserDto } from "../src/dto/create-user.dto.js";

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
        const response = await fetch(`${baseUrl}/users/42`);

        expect(response.status).toBe(200);
    })

    it('GET /users/42 — @Param arrives as an argument', async () => {
        const response = await fetch(`${baseUrl}/users/42`);
        const body = await response.json();

        expect(body.id).toBe('42');
    })

    it('GET /users?limit=5 — @Query arrives as a separate argument', async () => {
        const spy = vi.spyOn(UserController.prototype, 'listUsers');

        const response = await fetch(`${baseUrl}/users?limit=5`);

        expect(response.status).toBe(200);
        expect(spy.mock.calls.at(-1)).toEqual(['5']);

        spy.mockRestore();
    })

    it('GET /nope — an unknown route answers 404', async () => {
        const response = await fetch(`${baseUrl}/nope`);

        expect(response.status).toBe(404);
    })

    it('POST /users — @Body arrives parsed as a CreateUserDto instance', async () => {
        const spy = vi.spyOn(UserController.prototype, 'createUser');

        const response = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: 'dto@example.com'}),
        });

        expect(response.status).toBe(201);

        const [receivedBody] = spy.mock.calls.at(-1)!;
        expect(receivedBody).toBeInstanceOf(CreateUserDto);
        expect((receivedBody as CreateUserDto).email).toBe('dto@example.com');

        spy.mockRestore();
    })

    it('POST /users with {"email":"not-an-email"} — 400 listing the email field', async () => {
        const response = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: 'not-an-email'}),
        });

        expect(response.status).toBe(400);

        const text = await response.text();
        expect(text).toMatch(/email/);
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
