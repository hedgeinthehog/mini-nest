import { Controller, CONTROLLER_PATH, IS_CONTROLLER } from "../src/decorators/controller.js";
import { ROUTES_METADATA, Get, Post } from "../src/decorators/methods.js";
import { PARAMS_METADATA, Param, Query, Body } from "../src/decorators/params.js";
import { Injectable } from "../src/decorators/injectable.js";
import { Router } from "../src/router.js";
import { validateDto } from "../src/pipes/validation.pipe.js";
import { CreateUserDto } from "../src/dto/create-user.dto.js";
import { BadRequestError } from "../src/error.js";

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

describe('validateDto (ValidationPipe)', () => {
    it('turns a valid plain object into a DTO instance', async () => {
        const dto = await validateDto(CreateUserDto, {email: 'a@b.com'});

        expect(dto).toBeInstanceOf(CreateUserDto);
        expect(dto.email).toBe('a@b.com');
    });

    it('rejects an invalid payload with a per-field error list', async () => {
        await expect(validateDto(CreateUserDto, {email: 'not-an-email'}))
            .rejects.toMatchObject({
                details: expect.arrayContaining([
                    expect.objectContaining({field: 'email'}),
                ]),
            });
    });

    it('rejects with a BadRequestError specifically, not a generic Error', async () => {
        await expect(validateDto(CreateUserDto, {email: 'not-an-email'}))
            .rejects.toBeInstanceOf(BadRequestError);
    });

    it('strips fields that are not declared on the DTO (mass-assignment guard)', async () => {
        const dto = await validateDto(CreateUserDto, {email: 'a@b.com', role: 'admin'});

        expect(dto).toEqual({email: 'a@b.com'});
        expect('role' in dto).toBe(false);
    });
});
