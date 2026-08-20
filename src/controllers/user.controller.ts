import { Injectable } from "../decorators/injectable.js";
import { Controller } from "../decorators/controller.js";
import { Get, Post } from "../decorators/methods.js";
import { Param, Query, Body } from "../decorators/params.js";
import { UserService } from "../services/user.service.js";
import { CreateUserDto } from "../dto/create-user.dto.js";

@Injectable()
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    listUsers(@Query('limit') limit: string) {
        return this.userService.findAll(limit ? Number(limit) : undefined);
    }

    @Get(':id')
    getUser(@Param('id') id: string) {
        return { id, user: this.userService.findOne(id) ?? null };
    }

    @Post()
    createUser(@Body() body: CreateUserDto) {
        return this.userService.create(body);
    }
}
