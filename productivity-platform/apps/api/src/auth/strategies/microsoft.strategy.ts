import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-microsoft';
import { AuthService } from '../auth.service';

export interface MicrosoftProfile extends Profile {
  emails?: Array<{ value: string }>;
  displayName?: string;
  photos?: Array<{ url: string }>;
  preferredUsername?: string;
  mailboxSettings?: { timeZone: string };
  scopes?: string[];
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(MicrosoftStrategy.name);
  
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('MICROSOFT_CLIENT_ID'),
      clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET'),
      tenant: configService.get<string>('MICROSOFT_TENANT_ID') || 'common',
      callbackURL: configService.get<string>('MICROSOFT_REDIRECT_URI'),
      scope: configService.get<string>('MICROSOFT_SCOPES')?.split(',') || [
        'User.Read',
        'Calendars.ReadWrite',
        'offline_access',
      ],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string, 
    refreshToken: string, 
    profile: MicrosoftProfile
  ): Promise<any> {
    this.logger.debug('Validando perfil de Microsoft:', profile.id);

    // Validar que tenemos un email
    const email = profile.emails?.[0]?.value || profile.preferredUsername;
    if (!email) {
      this.logger.error('No se pudo obtener email del perfil de Microsoft');
      throw new Error('Email no disponible en el perfil de Microsoft');
    }

    // Extraer información del perfil de Microsoft
    const microsoftData = {
      microsoftId: profile.id,
      email: email.toLowerCase().trim(),
      displayName: profile.displayName?.trim(),
      avatarUrl: profile.photos?.[0]?.url,
    };

    this.logger.log(`Autenticando usuario: ${microsoftData.email}`);

    try {
      // Delegar al servicio de autenticación para crear/actualizar usuario
      const user = await this.authService.validateMicrosoftUser(
        microsoftData,
        accessToken,
        refreshToken,
        profile,
      );

      this.logger.log(`Usuario autenticado exitosamente: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('Error en validación de Microsoft:', error.message);
      throw error;
    }
  }
}
