import { CONTROLLER_PATH, IS_CONTROLLER } from "./decorators/controller.js";
import { ROUTES_METADATA } from "./decorators/methods.js";
import { Constructor } from "./container.js";

export type Route = {
    method: string;
    path: string;
    handler: string;
    controller: Constructor;
    pattern: URLPattern;
    statusCode: number;
}

export class Router {
    routes: Route[] = [];

    registerController(Controller: Constructor): void {
        const isController = Reflect.getOwnMetadata(IS_CONTROLLER, Controller);
        if (!isController) throw new Error(
            `Controller ${Controller.name} is not a controller`
        )

        const prefix = Reflect.getOwnMetadata(CONTROLLER_PATH, Controller);
        const routes = Reflect.getMetadata(ROUTES_METADATA, Controller) ?? [];

        for (const route of routes) {
            const fullPath = '/' + [prefix, route.path].filter(Boolean).join('/');

            const pattern = new URLPattern({ pathname: fullPath });

            this.routes.push({...route, path: fullPath, controller: Controller, pattern});
        }
    }

    find(method: string, path: string): { route: Route | null, params: Record<string, string> } {
        for (const route of this.routes) {
            if (route.method !== method) continue;

            const match = route.pattern.exec({ pathname: path });
            if (!match) continue;

            return { route, params: match.pathname.groups as Record<string, string> };
        }

        return { route: null, params: {} };
    }
}
