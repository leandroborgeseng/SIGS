import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RF } from '../common/rf';
import { CreateUserDto, LoginDto, UpdateUserDto } from './dto';
import { ROLE_SEEDS } from './roles.seed';
import { resolveSeedAdminCredentials } from './seed-admin';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async ensureRolesSeeded() {
    for (const seed of ROLE_SEEDS) {
      await this.prisma.role.upsert({
        where: { code: seed.code },
        create: {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          permissions: JSON.stringify([...seed.permissions]),
        },
        update: {
          name: seed.name,
          description: seed.description,
          permissions: JSON.stringify([...seed.permissions]),
        },
      });
    }
  }

  async ensureAdminSeeded() {
    await this.ensureRolesSeeded();
    const ti = await this.prisma.role.findUnique({ where: { code: 'TI' } });
    if (!ti) return;
    const { email, password, refuseReason } = resolveSeedAdminCredentials();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    if (!password) {
      // Produção sem senha forte: não cria admin fraco (deploys com admin já existente seguem ok).
      this.logger.warn(refuseReason || 'SEED_ADMIN_PASSWORD inválido — admin não criado.');
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        name: 'Administrador SIGS',
        email,
        passwordHash,
        roleId: ti.id,
        active: true,
      },
    });
  }

  async login(dto: LoginDto) {
    await this.ensureAdminSeeded();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { role: true },
    });
    if (!user || !user.active) throw new UnauthorizedException('Credenciais inválidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const permissions = JSON.parse(user.role.permissions || '[]') as string[];
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    await this.prisma.audit('login', 'user', user.id, [RF.AUTH.id]);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleCode: user.role.code,
        roleName: user.role.name,
        facilityId: user.facilityId,
        permissions,
      },
    };
  }

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } }).then((rows) =>
      rows.map((r) => ({
        ...r,
        permissions: JSON.parse(r.permissions || '[]'),
      })),
    );
  }

  listUsers() {
    return this.prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
    }).then((rows) =>
      rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        facilityId: u.facilityId,
        roleId: u.roleId,
        roleCode: u.role.code,
        roleName: u.role.name,
        createdAt: u.createdAt,
      })),
    );
  }

  async createUser(dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('roleId inválido');
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException('E-mail já cadastrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash,
        roleId: dto.roleId,
        facilityId: dto.facilityId,
      },
      include: { role: true },
    });
    await this.prisma.audit('create', 'user', user.id, [RF.USERS.id]);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code,
      active: user.active,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Usuário não encontrado');
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException('roleId inválido');
    }
    const data: Record<string, unknown> = {
      name: dto.name,
      roleId: dto.roleId,
      facilityId: dto.facilityId,
      active: dto.active,
    };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    const updated = await this.prisma.user.update({ where: { id }, data, include: { role: true } });
    await this.prisma.audit('update', 'user', id, [RF.USERS.id]);
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      roleCode: updated.role.code,
      active: updated.active,
    };
  }
}
