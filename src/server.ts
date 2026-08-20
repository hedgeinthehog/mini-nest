import http from 'node:http';
import { Dispatcher } from "./dispatcher.js";
import { Container } from "./container.js";
import { Router } from "./router.js";
import { UserController } from "./controllers/user.controller.js";

export function createApp() {
    const container = new Container();
    const router = new Router();

    router.registerController(UserController);

    const dispatcher = new Dispatcher(router, container);

    return http.createServer((req, res) => {
        dispatcher.dispatch(req, res);
    })
}
