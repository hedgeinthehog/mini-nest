import { ServerResponse, IncomingMessage } from "node:http";
import { Route, Router } from "./router.js";
import { Container } from "./container.js";
import { PARAMS_METADATA, paramsType } from "./decorators/params.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "./error.js";
import { validateWithSchema } from "./pipes/zod-validation.pipe.js";
import { requestContext } from "./context/request-context.js";
import { getEffectiveGuards, Guard } from "./decorators/use-guards.js";
import { ExceptionFilter } from "./filters/exception.filter.js";
import { ZodType } from "zod";
import { Constructor } from "./container.js";
import { getEffectiveInterceptors, Interceptor } from "./decorators/use-interceptors.js";

type ParamMeta = { type: paramsType; name?: string; schema?: ZodType };

type Ctx = {
    req: IncomingMessage;
    res: ServerResponse;
    url: URL;
    route?: Route;
    params?: Record<string, string>;
    paramsMeta?: Map<number, ParamMeta>;
    guards?: Constructor<Guard>[];
    interceptors?: Constructor<Interceptor>[];
    interceptorState?: Map<Constructor<Interceptor>, unknown>;
    body?: unknown;
    args?: any[];
    controllerInstance?: any;
    result?: unknown;
};

type Stage = (ctx: Ctx) => Ctx | Promise<Ctx>;

export class Dispatcher {
    private readonly exceptionFilter = new ExceptionFilter();

    constructor(
        private readonly router: Router,
        private readonly container: Container
    ) {}

    private readBody(req: IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
                const buffer = Buffer.concat(chunks);
                try {
                    resolve(JSON.parse(buffer.toString()));
                } catch (e) {
                    reject(new BadRequestError('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });
    }

    private findRoute = (ctx: Ctx): Ctx => {
        const { route, params } = this.router.find(ctx.req.method ?? 'GET', ctx.url.pathname);

        if (!route) throw new NotFoundError(`Route ${ctx.req.method ?? 'GET'} ${ctx.url.pathname} not found`);

        return { ...ctx, route, params };
    }

    private readParamsMeta = (ctx: Ctx): Ctx => {
        const paramsMeta: Map<number, ParamMeta> =
            Reflect.getOwnMetadata(PARAMS_METADATA, ctx.route!.controller.prototype, ctx.route!.handler) ?? new Map();

        return { ...ctx, paramsMeta };
    }

    private readGuards = (ctx: Ctx): Ctx => {
        return { ...ctx, guards: getEffectiveGuards(ctx.route!.controller, ctx.route!.handler) };
    }

    private middleware = (ctx: Ctx): Ctx => {
        requestContext.mark('middleware');
        return ctx;
    }

    private guard = (ctx: Ctx): Ctx => {
        requestContext.mark('guard');

        for (const GuardClass of ctx.guards!) {
            const guard = this.container.resolve(GuardClass);

            if (!guard.canActivate(ctx.req)) {
                throw new ForbiddenError('Forbidden');
            }
        }

        return ctx;
    }

    private interceptorBefore = (ctx: Ctx): Ctx => {
        requestContext.mark('interceptor:before');

        const interceptors = getEffectiveInterceptors(ctx.route!.controller, ctx.route!.handler);
        const interceptorState = new Map<Constructor<Interceptor>, unknown>();

        for (const InterceptorClass of interceptors) {
            const interceptor = this.container.resolve(InterceptorClass);
            interceptorState.set(InterceptorClass, interceptor.before(ctx.req, ctx.res));
        }

        return { ...ctx, interceptors, interceptorState };
    }

    private pipe = async (ctx: Ctx): Promise<Ctx> => {
        requestContext.mark('pipe');

        const needsBody = [...ctx.paramsMeta!.values()].some(p => p.type === 'body');
        const body = needsBody ? await this.readBody(ctx.req) : undefined;

        const args: any[] = [];

        for (const [index, param] of ctx.paramsMeta!.entries()) {
            if (param.type === paramsType.param) args[index] = ctx.params![param.name!];
            if (param.type === paramsType.query) args[index] = ctx.url.searchParams.get(param.name!);
            if (param.type === paramsType.body) {
                args[index] = param.schema
                    ? validateWithSchema(param.schema, body)
                    : body;
            }
        }

        return { ...ctx, body, args };
    }

    private handler = async (ctx: Ctx): Promise<Ctx> => {
        requestContext.mark('handler');

        const controllerInstance = this.container.resolve(ctx.route!.controller);
        const result = await controllerInstance[ctx.route!.handler](...ctx.args!);

        return { ...ctx, controllerInstance, result };
    }

    private interceptorAfter = (ctx: Ctx): Ctx => {
        requestContext.mark('interceptor:after');

        for (const InterceptorClass of [...ctx.interceptors!].reverse()) {
            const interceptor = this.container.resolve(InterceptorClass);
            const state = ctx.interceptorState!.get(InterceptorClass);

            interceptor.after(state, ctx.req, ctx.res);
        }

        return ctx;
    }

    private serializeResponse = (ctx: Ctx): Ctx => {
        ctx.res.writeHead(ctx.route!.statusCode, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify(ctx.result));

        return ctx;
    }

    private readonly stages: Stage[] = [
        this.findRoute,
        this.readParamsMeta,
        this.readGuards,
        this.middleware,
        this.guard,
        this.interceptorBefore,
        this.pipe,
        this.handler,
        this.interceptorAfter,
        this.serializeResponse,
    ];

    async dispatch(
        req: IncomingMessage,
        res: ServerResponse
    ) {
        const url = new URL(
            req.url ?? '/',
            `http://${req.headers.host ?? 'localhost'}`
        )

        const incomingRequestId = req.headers['x-request-id'];

        await requestContext.run(
            Array.isArray(incomingRequestId) ? incomingRequestId[0] : incomingRequestId,
            async () => {
                res.setHeader('X-Request-Id', requestContext.requestId);

                let ctx: Ctx = { req, res, url };

                try {
                    for (const stage of this.stages) {
                        ctx = await stage(ctx);
                    }
                } catch (e) {
                    this.exceptionFilter.catch(e, res);
                }
            }
        );
    }
}
