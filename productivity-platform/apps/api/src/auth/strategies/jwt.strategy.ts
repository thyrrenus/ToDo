import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaClient } from '@prisma/client';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  microsoftId?: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private prisma: PrismaClient;

  constructor(
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
      passReqToCallback: false,
    });

    this.prisma = new PrismaClient();
  }

  async validate(payload: JwtPayload) {
    // Verificar que el usuario existe en la base de datos
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        microsoftId: true,
        timezone: true,
        settings: true,
      },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      ...user,
      role: user.role.toLowerCase(),
    };
  }
}
