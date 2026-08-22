import { ServerResponse, IncomingMessage } from "node:http";
import { Route, Router } from "./router.js";
import { Container } from "./container.js";
import { PARAMS_METADATA, paramsType } from "./decorators/params.js";
import { BadRequestError, NotFoundError } from "./error.js";
import { validateDto } from "./pipes/validation.pipe.js";

type ParamMeta = { type: paramsType; name?: string };

type Ctx = {
    req: IncomingMessage;
    res: ServerResponse;
    url: URL;
    route?: Route;
    params?: Record<string, string>;
    paramsMeta?: Map<number, ParamMeta>;
    paramTypes?: any[];
    body?: unknown;
    args?: any[];
    controllerInstance?: any;
    result?: unknown;
};

type Stage = (ctx: Ctx) => Ctx | Promise<Ctx>;

export class Dispatcher {
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

        if (!route) throw new NotFoundError('Not Found');

        return { ...ctx, route, params };
    }

    private readParamsMeta = (ctx: Ctx): Ctx => {
        const paramsMeta: Map<number, ParamMeta> =
            Reflect.getOwnMetadata(PARAMS_METADATA, ctx.route!.controller.prototype, ctx.route!.handler) ?? new Map();

        const paramTypes =
            Reflect.getMetadata('design:paramtypes', ctx.route!.controller.prototype, ctx.route!.handler) ?? [];

        return { ...ctx, paramsMeta, paramTypes };
    }

    private parseBody = async (ctx: Ctx): Promise<Ctx> => {
        const needsBody = [...ctx.paramsMeta!.values()].some(p => p.type === 'body');
        const body = needsBody ? await this.readBody(ctx.req) : undefined;

        return { ...ctx, body };
    }

    private resolveController = (ctx: Ctx): Ctx => {
        const controllerInstance = this.container.resolve(ctx.route!.controller);

        return { ...ctx, controllerInstance };
    }

    private buildArgs = async (ctx: Ctx): Promise<Ctx> => {
        const args: any[] = [];

        for (const [index, param] of ctx.paramsMeta!.entries()) {
            if (param.type === paramsType.param) args[index] = ctx.params![param.name!];
            if (param.type === paramsType.query) args[index] = ctx.url.searchParams.get(param.name!);
            if (param.type === paramsType.body) {
                const Dto = ctx.paramTypes![index];
                args[index] = (Dto && Dto !== Object)
                    ? await validateDto(Dto, ctx.body)
                    : ctx.body;
            }
        }

        return { ...ctx, args };
    }

    private handle = async (ctx: Ctx): Promise<Ctx> => {
        const result = await ctx.controllerInstance[ctx.route!.handler](...ctx.args!);

        return { ...ctx, result };
    }

    private serializeResponse = (ctx: Ctx): Ctx => {
        ctx.res.writeHead(ctx.route!.statusCode, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify(ctx.result));

        return ctx;
    }

    private readonly stages: Stage[] = [
        this.findRoute,
        this.readParamsMeta,
        this.parseBody,
        this.resolveController,
        this.buildArgs,
        this.handle,
        this.serializeResponse,
    ];

    private respondWithError(e: unknown, res: ServerResponse) {
        if (e instanceof NotFoundError) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        } else if (e instanceof BadRequestError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message, details: e.details }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end();
        }
    }

    async dispatch(
        req: IncomingMessage,
        res: ServerResponse
    ) {
        const url = new URL(
            req.url ?? '/',
            `http://${req.headers.host ?? 'localhost'}`
        )

        let ctx: Ctx = { req, res, url };

        try {
            for (const stage of this.stages) {
                ctx = await stage(ctx);
            }
        } catch (e) {
            this.respondWithError(e, res);
        }
    }
}
