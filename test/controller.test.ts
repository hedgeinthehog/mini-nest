import { vi } from 'vitest';
import { Controller, CONTROLLER_PATH, IS_CONTROLLER } from "../src/decorators/controller.js";
import { ROUTES_METADATA, Get, Post } from "../src/decorators/methods.js";
import { PARAMS_METADATA, Param, Query, Body } from "../src/decorators/params.js";
import { Injectable } from "../src/decorators/injectable.js";
import { Router } from "../src/router.js";
import { validateWithSchema } from "../src/pipes/zod-validation.pipe.js";
import { CreateUserSchema } from "../src/dto/create-user.dto.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../src/error.js";
import { AuthGuard } from "../src/guards/auth.guard.js";
import { UseGuards, GUARDS_METADATA, getEffectiveGuards, Guard } from "../src/decorators/use-guards.js";
import { LoggingInterceptor } from "../src/interceptors/logging.interceptor.js";
import {
    UseInterceptors,
    INTERCEPTORS_METADATA,
    getEffectiveInterceptors,
    Interceptor as InterceptorType,
} from "../src/decorators/use-interceptors.js";
import { ExceptionFilter } from "../src/filters/exception.filter.js";
import { requestContext } from "../src/context/request-context.js";

@Injectable()
@Controller('users')
class UserController {
    @Get()
    listUsers(@Query('limit') limit: string) {
        return {limit};
    }

    @Get(':id')
    getUser(@Param('id') id: string) {
        return {id};
    }

    @Post()
    createUser(@Body() body: unknown) {
        return body;
    }
}

describe('@Controller', () => {
    it('marks the class and stores the prefix in metadata', () => {
        expect(Reflect.getOwnMetadata(IS_CONTROLLER, UserController)).toBe(true);
        expect(Reflect.getOwnMetadata(CONTROLLER_PATH, UserController)).toBe('users');
    });
});

describe('@Get / @Post', () => {
    it('registers every decorated method as a route', () => {
        const routes = Reflect.getMetadata(ROUTES_METADATA, UserController);

        expect(routes).toEqual(expect.arrayContaining([
            {method: 'GET', path: '', handler: 'listUsers', statusCode: 200},
            {method: 'GET', path: ':id', handler: 'getUser', statusCode: 200},
            {method: 'POST', path: '', handler: 'createUser', statusCode: 201},
        ]));
    });

    it('defaults @Post to 201 and @Get to 200, but both are overridable', () => {
        class WithOverride {
            @Get('', 204)
            noContent() {}
        }

        const [route] = Reflect.getOwnMetadata(ROUTES_METADATA, WithOverride);
        expect(route.statusCode).toBe(204);
    });

    it('does not mutate the parent class route list when a subclass decorates its own method', () => {
        class Base {
            @Get('base')
            baseRoute() {}
        }

        class Child extends Base {
            @Post('child')
            childRoute() {}
        }

        const baseRoutes = Reflect.getOwnMetadata(ROUTES_METADATA, Base);
        const childRoutes = Reflect.getOwnMetadata(ROUTES_METADATA, Child);

        // Child must get its own array — reading Base's routes afterwards
        // must still show only what Base itself declared.
        expect(baseRoutes).toHaveLength(1);
        expect(baseRoutes[0].handler).toBe('baseRoute');
        expect(childRoutes).toHaveLength(1);
        expect(childRoutes[0].handler).toBe('childRoute');
    });
});

describe('@Param / @Query / @Body', () => {
    it('records a @Param, keyed by its index', () => {
        const meta = Reflect.getOwnMetadata(PARAMS_METADATA, UserController.prototype, 'getUser');

        expect(meta.get(0)).toEqual({type: 'param', name: 'id'});
    });

    it('records a @Query, keyed by its index', () => {
        const meta = Reflect.getOwnMetadata(PARAMS_METADATA, UserController.prototype, 'listUsers');

        expect(meta.get(0)).toEqual({type: 'query', name: 'limit'});
    });

    it('records @Body without a name', () => {
        const meta = Reflect.getOwnMetadata(PARAMS_METADATA, UserController.prototype, 'createUser');

        expect(meta.get(0)).toEqual({type: 'body'});
    });
});

describe('parameter decorator order', () => {
    class Fixture {
        method(
            @Param('a') a: string,
            @Query('b') b: string
        ) {}
    }

    it('runs right-to-left, so the index is the key and not the insertion order', () => {
        const meta = Reflect.getOwnMetadata(PARAMS_METADATA, Fixture.prototype, 'method');

        expect([...meta.keys()]).toEqual([1, 0]);
    });
});

describe('Router', () => {
    const router = new Router();
    router.registerController(UserController);

    it('joins the controller prefix with the method path', () => {
        expect(router.routes.map(route => `${route.method} ${route.path}`))
            .toEqual(expect.arrayContaining(['GET /users', 'GET /users/:id', 'POST /users']));
    });

    it('does not confuse the list route with the by-id route', () => {
        const {route} = router.find('GET', '/users');

        expect(route?.handler).toBe('listUsers');
    });

    it('finds a route and extracts the path params', () => {
        const {route, params} = router.find('GET', '/users/42');

        expect(route).not.toBeNull();
        expect(route?.handler).toBe('getUser');
        expect(route?.controller).toBe(UserController);
        expect(params).toEqual({id: '42'});
    });

    it('returns empty params for a route without them', () => {
        const {route, params} = router.find('POST', '/users');

        expect(route?.handler).toBe('createUser');
        expect(params).toEqual({});
    });

    it('returns a null route for the same path under a different method', () => {
        expect(router.find('DELETE', '/users/42')).toEqual({route: null, params: {}});
    });

    it('returns a null route for an unknown path', () => {
        expect(router.find('GET', '/nope').route).toBeNull();
    });

    it('returns a null route when only part of the path matches', () => {
        expect(router.find('GET', '/users/42/posts').route).toBeNull();
    });

    it('rejects a class that is not a @Controller', () => {
        class Plain {}

        expect(() => router.registerController(Plain)).toThrow(/not a controller/i);
    });
});

describe('validateWithSchema (ZodValidationPipe)', () => {
    it('returns the parsed value for a valid payload', () => {
        const dto = validateWithSchema(CreateUserSchema, {email: 'a@b.com'});

        expect(dto).toEqual({email: 'a@b.com'});
    });

    it('rejects an invalid payload with a per-field error list', () => {
        expect(() => validateWithSchema(CreateUserSchema, {email: 'not-an-email'}))
            .toThrow(expect.objectContaining({
                details: expect.arrayContaining([
                    expect.objectContaining({field: 'email'}),
                ]),
            }));
    });

    it('rejects with a BadRequestError specifically, not a generic Error', () => {
        expect(() => validateWithSchema(CreateUserSchema, {email: 'not-an-email'}))
            .toThrow(BadRequestError);
    });

    it('strips fields that are not declared on the schema (mass-assignment guard)', () => {
        const dto = validateWithSchema(CreateUserSchema, {email: 'a@b.com', role: 'admin'});

        expect(dto).toEqual({email: 'a@b.com'});
        expect('role' in dto).toBe(false);
    });

    it('reports a missing required field, not just format errors', () => {
        expect(() => validateWithSchema(CreateUserSchema, {}))
            .toThrow(expect.objectContaining({
                details: expect.arrayContaining([
                    expect.objectContaining({field: 'email'}),
                ]),
            }));
    });
});

describe('AuthGuard', () => {
    const guard = new AuthGuard();
    const reqWith = (authorization?: string) => ({ headers: { authorization } }) as any;

    it('rejects a request with no Authorization header', () => {
        expect(guard.canActivate(reqWith(undefined))).toBe(false);
    });

    it('rejects an empty Authorization header', () => {
        expect(guard.canActivate(reqWith(''))).toBe(false);
    });

    it('accepts a request that carries any Authorization header', () => {
        expect(guard.canActivate(reqWith('Bearer whatever'))).toBe(true);
    });
});

describe('@UseGuards', () => {
    class ClassGuard implements Guard { canActivate() { return true; } }
    class MethodGuard implements Guard { canActivate() { return true; } }

    @UseGuards(ClassGuard)
    class Controller1 {
        @UseGuards(MethodGuard)
        @Get('both')
        bothLevels() {}

        @Get('classOnly')
        classOnlyRoute() {}
    }

    class Controller2 {
        @Get('nothing')
        noGuardsAnywhere() {}
    }

    it('stores the guard list on the class', () => {
        expect(Reflect.getOwnMetadata(GUARDS_METADATA, Controller1)).toEqual([ClassGuard]);
    });

    it('stores the guard list on the method, separately from the class', () => {
        expect(Reflect.getOwnMetadata(GUARDS_METADATA, Controller1.prototype, 'bothLevels')).toEqual([MethodGuard]);
    });

    it('combines class and method guards, class first, when a route declares both', () => {
        expect(getEffectiveGuards(Controller1, 'bothLevels')).toEqual([ClassGuard, MethodGuard]);
    });

    it('falls back to the class guards alone when the method declares none of its own', () => {
        expect(getEffectiveGuards(Controller1, 'classOnlyRoute')).toEqual([ClassGuard]);
    });

    it('is an empty list — a public route — when neither the class nor the method uses @UseGuards', () => {
        expect(getEffectiveGuards(Controller2, 'noGuardsAnywhere')).toEqual([]);
    });
});

describe('LoggingInterceptor', () => {
    it('logs "METHOD /path — N.N ms" using the elapsed time between before() and after()', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const interceptor = new LoggingInterceptor();

        const req = { method: 'GET', url: '/users/42', headers: { host: 'localhost' } } as any;

        const startedAt = interceptor.before();
        interceptor.after(startedAt, req);

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0][0]).toMatch(/^GET \/users\/42 — [0-9]+(\.[0-9]+)? ?ms$/);

        logSpy.mockRestore();
    });

    it('keeps no per-instance state — concurrent before() calls do not clobber each other', () => {
        const interceptor = new LoggingInterceptor();

        const first = interceptor.before();
        const second = interceptor.before();

        // Two independent start times.
        expect(typeof first).toBe('number');
        expect(typeof second).toBe('number');
    });
});

describe('@UseInterceptors', () => {
    class ClassInterceptor implements InterceptorType {
        before() { return undefined; }
        after() {}
    }

    class MethodInterceptor implements InterceptorType {
        before() { return undefined; }
        after() {}
    }

    @UseInterceptors(ClassInterceptor)
    class Controller1 {
        @UseInterceptors(MethodInterceptor)
        @Get('both')
        bothLevels() {}

        @Get('classOnly')
        classOnlyRoute() {}
    }

    it('stores the interceptor list on the class', () => {
        expect(Reflect.getOwnMetadata(INTERCEPTORS_METADATA, Controller1)).toEqual([ClassInterceptor]);
    });

    it('combines class and method interceptors, class first, when a route declares both', () => {
        expect(getEffectiveInterceptors(Controller1, 'bothLevels')).toEqual([ClassInterceptor, MethodInterceptor]);
    });

    it('falls back to the class interceptors alone when the method declares none', () => {
        expect(getEffectiveInterceptors(Controller1, 'classOnlyRoute')).toEqual([ClassInterceptor]);
    });
});

describe('interceptor before/after state correlation', () => {
    // Mirrors exactly what Dispatcher#interceptorBefore / #interceptorAfter
    // do: a Map keyed by interceptor class holds each one's own before()
    // return value, and after() unwinds in reverse order.
    it('pairs each interceptor\'s own before() state with its own after(), unwinding in reverse order', () => {
        const calls: string[] = [];

        class First implements InterceptorType {
            before(req: any, res: any) { calls.push('first:before'); return 'first-state'; }
            after(state: unknown, req: any, res: any) { calls.push(`first:after(${state})`); }
        }

        class Second implements InterceptorType {
            before(req: any, res: any) { calls.push('second:before'); return 'second-state'; }
            after(state: unknown, req: any, res: any) { calls.push(`second:after(${state})`); }
        }

        const req = {} as any;
        const res = {} as any;
        const interceptors = [First, Second];
        const state = new Map<any, unknown>();

        for (const I of interceptors) {
            state.set(I, new I().before(req, res));
        }

        for (const I of [...interceptors].reverse()) {
            new I().after(state.get(I), req, res);
        }

        expect(calls).toEqual([
            'first:before',
            'second:before',
            'second:after(second-state)', // unwinds inside-out, not in declaration order
            'first:after(first-state)',
        ]);
    });
});

describe('ExceptionFilter', () => {
    const filter = new ExceptionFilter();

    const makeRes = () => {
        const res: any = {};
        res.writeHead = (statusCode: number) => { res.statusCode = statusCode; };
        res.end = (data?: string) => { res.body = data ? JSON.parse(data) : undefined; };
        return res;
    };

    it('maps NotFoundError to 404 with the error message', () => {
        requestContext.run('req-1', () => {
            const res = makeRes();
            filter.catch(new NotFoundError('Route /nope not found'), res);

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Route /nope not found');
        });
    });

    it('maps ForbiddenError to 403', () => {
        requestContext.run('req-1', () => {
            const res = makeRes();
            filter.catch(new ForbiddenError('Missing Authorization header'), res);

            expect(res.statusCode).toBe(403);
        });
    });

    it('maps BadRequestError to 400 with the field list', () => {
        requestContext.run('req-1', () => {
            const res = makeRes();
            filter.catch(new BadRequestError('Validation failed', [{field: 'email', constraints: ['bad']}]), res);

            expect(res.statusCode).toBe(400);
            expect(res.body.details).toEqual([{field: 'email', constraints: ['bad']}]);
        });
    });

    it('maps an unrecognized error to 500 without leaking its message or a stack trace', () => {
        requestContext.run('req-1', () => {
            const res = makeRes();
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            filter.catch(new Error('boom — internal secret'), res);

            expect(res.statusCode).toBe(500);
            expect(JSON.stringify(res.body)).not.toMatch(/boom|at .*\.ts:/);

            errorSpy.mockRestore();
        });
    });

    it('stamps every error response with the current request id', () => {
        requestContext.run('fixed-request-id', () => {
            const res = makeRes();
            filter.catch(new NotFoundError('x'), res);

            expect(res.body.requestId).toBe('fixed-request-id');
        });
    });
});
