import { CONTROLLER_PATH, IS_CONTROLLER } from "./decorators/controller.js";
import { ROUTES_METADATA } from "./decorators/methods.js";
import { Constructor } from "./container.js";

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Route = {
    method: string;
    path: string;
    handler: string;
    controller: Constructor;
    pathRegex: RegExp;
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

            const pathRegex = new RegExp(
                `^${escapeRegExp(fullPath).replace(/:([^/]+)/g, '(?<$1>[^/]+)')}$`
            );

            this.routes.push({...route, path: fullPath, controller: Controller, pathRegex});
        }
    }

    find(method: string, path: string): { route: Route | null, params: Record<string, string> } {
        for (const route of this.routes) {
            if (route.method !== method) continue;

            const match = route.pathRegex.exec(path);
            if (!match) continue;

            return { route, params: {...match.groups} };
        }

        return { route: null, params: {} };
    }
}