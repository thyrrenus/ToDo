import { Injectable, Logger, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, User, OutlookToken as OutlookTokenModel } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import * as bcrypt from 'bcrypt';

export interface MicrosoftProfileData {
  microsoftId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResult extends User {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private prisma: PrismaClient;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly microsoftTenantId: string;
  private readonly microsoftClientId: string;
  private readonly microsoftClientSecret: string;
  private readonly microsoftScopes: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.prisma = new PrismaClient();
    
    // Cargar configuración una vez
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret-key-change-in-production';
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    this.refreshExpiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '30d');
    this.microsoftTenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';
    this.microsoftClientId = this.configService.get<string>('MICROSOFT_CLIENT_ID') || '';
    this.microsoftClientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET') || '';
    this.microsoftScopes = this.configService.get<string>('MICROSOFT_SCOPES') || 'User.Read,Calendars.ReadWrite,offline_access';
  }

  /**
   * Validar usuario de Microsoft y crear/actualizar registro
   */
  async validateMicrosoftUser(
    profileData: MicrosoftProfileData,
    accessToken: string,
    refreshToken: string,
    fullProfile: any,
  ): Promise<AuthResult> {
    this.logger.log(`Validando usuario Microsoft: ${profileData.email}`);

    try {
      // Buscar usuario existente por Microsoft ID
      let user = await this.prisma.user.findUnique({
        where: { microsoftId: profileData.microsoftId },
      });

      if (user) {
        // Usuario existe - actualizar información y tokens
        await this.updateUserTokens(user.id, accessToken, refreshToken, fullProfile);
        this.logger.log(`Usuario existente actualizado: ${user.id}`);
      } else {
        // Buscar por email para evitar duplicados
        user = await this.prisma.user.findUnique({
          where: { email: profileData.email },
        });

        if (user) {
          // Usuario existe con email pero sin Microsoft ID - vincular cuenta
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              microsoftId: profileData.microsoftId,
              displayName: profileData.displayName || user.displayName,
              avatarUrl: profileData.avatarUrl || user.avatarUrl,
            },
          });
          await this.createOutlookToken(user.id, accessToken, refreshToken, fullProfile);
          this.logger.log(`Cuenta vinculada: ${user.id}`);
        } else {
          // Usuario nuevo - crear registro
          user = await this.createUserWithTokens(
            profileData,
            accessToken,
            refreshToken,
            fullProfile,
          );
          this.logger.log(`Nuevo usuario creado: ${user.id}`);
        }
      }

      // Generar JWT tokens de la aplicación
      const tokens = await this.generateTokens(user);

      return {
        ...user,
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Error al validar usuario Microsoft:', error.message, error.stack);
      throw new UnauthorizedException('Error al autenticar con Microsoft');
    }
  }

  /**
   * Crear usuario con tokens de Outlook
   */
  private async createUserWithTokens(
    profileData: MicrosoftProfileData,
    accessToken: string,
    refreshToken: string,
    fullProfile: any,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      // Crear usuario
      const user = await tx.user.create({
        data: {
          email: profileData.email.toLowerCase().trim(),
          microsoftId: profileData.microsoftId,
          displayName: profileData.displayName?.trim() || profileData.email.split('@')[0],
          avatarUrl: profileData.avatarUrl,
          timezone: this.extractTimezone(fullProfile),
          role: 'USER',
        },
      });

      // Guardar tokens de Outlook
      await tx.outlookToken.create({
        data: {
          userId: user.id,
          accessToken,
          refreshToken,
          expiresAt: this.getTokenExpiration(accessToken),
          scopes: this.extractScopes(fullProfile),
        },
      });

      // Crear proyecto Inbox por defecto
      await tx.project.create({
        data: {
          userId: user.id,
          name: 'Inbox',
          color: '#3B82F6',
          icon: '📥',
          order: 0,
          isFavorite: true,
        },
      });

      this.logger.log(`Usuario creado con ID: ${user.id}, Inbox project creado`);
      return user;
    });
  }

  /**
   * Actualizar tokens existentes
   */
  private async updateUserTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    fullProfile: any,
  ): Promise<void> {
    await this.prisma.outlookToken.upsert({
      where: { userId },
      update: {
        accessToken,
        refreshToken,
        expiresAt: this.getTokenExpiration(accessToken),
        scopes: this.extractScopes(fullProfile),
        updatedAt: new Date(),
      },
      create: {
        userId,
        accessToken,
        refreshToken,
        expiresAt: this.getTokenExpiration(accessToken),
        scopes: this.extractScopes(fullProfile),
      },
    });
    this.logger.debug(`Tokens actualizados para usuario: ${userId}`);
  }

  /**
   * Crear token de Outlook (método separado para transacciones)
   * @deprecated Usar directamente tx.outlookToken.create en transacciones
   */
  private async createOutlookToken(
    userId: string,
    accessToken: string,
    refreshToken: string,
    fullProfile: any,
  ): Promise<void> {
    await this.prisma.outlookToken.create({
      data: {
        userId,
        accessToken,
        refreshToken,
        expiresAt: this.getTokenExpiration(accessToken),
        scopes: this.extractScopes(fullProfile),
      },
    });
  }

  /**
   * Generar JWT tokens para la aplicación
   */
  async generateTokens(user: User): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          microsoftId: user.microsoftId,
          role: user.role,
        },
        {
          secret: this.jwtSecret,
          expiresIn: this.jwtExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: user.id,
          type: 'refresh',
        },
        {
          secret: this.jwtSecret,
          expiresIn: this.refreshExpiresIn,
        },
      ),
    ]);

    // Calcular expiresIn en segundos
    const expiresIn = this.parseExpirationToSeconds(this.jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Parsear string de expiración a segundos
   */
  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 604800; // default 7 días

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 604800;
    }
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync(
        { token: refreshToken },
        { secret: this.jwtSecret },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token inválido');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      return await this.generateTokens(user);
    } catch (error) {
      this.logger.error('Error al refresh tokens:', error.message);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Obtener token de Outlook fresco (con refresh si es necesario)
   */
  async getFreshOutlookToken(userId: string): Promise<string> {
    const outlookToken = await this.prisma.outlookToken.findUnique({
      where: { userId },
    });

    if (!outlookToken) {
      throw new BadRequestException('Usuario no ha conectado Outlook');
    }

    // Verificar si el token está cerca de expirar (5 minutos)
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (outlookToken.expiresAt < fiveMinutesFromNow) {
      // Token próximo a expirar - hacer refresh
      this.logger.log(`Refreshing Outlook token para usuario ${userId}`);
      
      try {
        const response = await axios.post(
          `https://login.microsoftonline.com/${this.microsoftTenantId}/oauth2/v2.0/token`,
          new URLSearchParams({
            client_id: this.microsoftClientId,
            client_secret: this.microsoftClientSecret,
            scope: this.microsoftScopes,
            grant_type: 'refresh_token',
            refresh_token: outlookToken.refreshToken,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token || outlookToken.refreshToken;

        // Actualizar en base de datos
        await this.prisma.outlookToken.update({
          where: { userId },
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: this.getTokenExpiration(newAccessToken),
            updatedAt: new Date(),
          },
        });

        this.logger.log(`Token Outlook refreshado exitosamente para usuario ${userId}`);
        return newAccessToken;
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.error(
          'Error al refresh Outlook token:', 
          axiosError.response?.data || axiosError.message,
        );
        throw new BadRequestException('Error al actualizar token de Outlook');
      }
    }

    return outlookToken.accessToken;
  }

  /**
   * Extraer timezone del perfil de Microsoft
   */
  private extractTimezone(profile: any): string {
    try {
      return profile.mailboxSettings?.timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * Extraer scopes del perfil
   */
  private extractScopes(profile: any): string[] {
    try {
      return profile.scopes || [];
    } catch {
      return [];
    }
  }

  /**
   * Calcular expiración del token desde JWT
   */
  private getTokenExpiration(token: string): Date {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
      // Por defecto, 1 hora desde ahora
      return new Date(Date.now() + 3600000);
    } catch (error) {
      this.logger.warn('Error al parsear token para expiración:', error.message);
      // Por defecto, 1 hora
      return new Date(Date.now() + 3600000);
    }
  }

  /**
   * Logout - Invalidar tokens (opcional con blacklist)
   */
  async logout(userId: string): Promise<{ message: string }> {
    // En producción, implementar blacklist de tokens con Redis
    this.logger.log(`Logout usuario: ${userId}`);
    return { message: 'Sesión cerrada correctamente' };
  }

  /**
   * Obtener perfil completo del usuario
   */
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        microsoftId: true,
        timezone: true,
        role: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            isFavorite: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
        outlookTokens: {
          select: {
            id: true,
            expiresAt: true,
            scopes: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}
