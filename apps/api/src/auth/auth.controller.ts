import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, UpdateUserDto } from './dto';
import { Public, RequirePermissions } from './decorators';
import { PERMISSIONS } from './roles.seed';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('v1/auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('v1/auth/me')
  me(@Req() req: { user: unknown }) {
    return req.user;
  }

  @Get('v1/roles')
  @RequirePermissions(PERMISSIONS.USERS)
  listRoles() {
    return this.auth.listRoles();
  }

  @Get('v1/users')
  @RequirePermissions(PERMISSIONS.USERS)
  listUsers() {
    return this.auth.listUsers();
  }

  @Post('v1/users')
  @RequirePermissions(PERMISSIONS.USERS)
  createUser(@Body() dto: CreateUserDto) {
    return this.auth.createUser(dto);
  }

  @Patch('v1/users/:id')
  @RequirePermissions(PERMISSIONS.USERS)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.auth.updateUser(id, dto);
  }
}
