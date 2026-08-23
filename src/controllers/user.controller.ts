import { Injectable } from "../decorators/injectable.js";
import { Controller } from "../decorators/controller.js";
import { Get, Post } from "../decorators/methods.js";
import { Param, Query, Body } from "../decorators/params.js";
import { UseGuards } from "../decorators/use-guards.js";
import { AuthGuard } from "../guards/auth.guard.js";
import { UserService } from "../services/user.service.js";
import { CreateUserDto, CreateUserSchema } from "../dto/create-user.dto.js";
import { UseInterceptors } from "../decorators/use-interceptors.js";
import { LoggingInterceptor } from "../interceptors/logging.interceptor.js";

@Injectable()
@Controller('users')
@UseInterceptors(LoggingInterceptor)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    listUsers(@Query('limit') limit: string) {
        return this.userService.findAll(limit ? Number(limit) : undefined);
    }

    @UseGuards(AuthGuard)
    @Get(':id')
    getUser(@Param('id') id: string) {
        return { id, user: this.userService.findOne(id) ?? null };
    }

    @UseGuards(AuthGuard)
    @Post()
    createUser(@Body(CreateUserSchema) body: CreateUserDto) {
        return this.userService.create(body);
    }
}
