import { ApiProperty } from '@nestjs/swagger';

export class TokenPayloadDto {
  @ApiProperty({ description: 'Access token JWT' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token para obtener nuevo access token' })
  refreshToken: string;

  @ApiProperty({ description: 'Tipo de token', example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: 'Duración del token en segundos', example: 604800 })
  expiresIn: number;
}

export class UserDto {
  @ApiProperty({ description: 'ID único del usuario' })
  id: string;

  @ApiProperty({ description: 'Email del usuario' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', required: false })
  displayName?: string;

  @ApiProperty({ description: 'URL del avatar', required: false })
  avatarUrl?: string;

  @ApiProperty({ description: 'Rol del usuario', enum: ['user', 'premium', 'admin'] })
  role: string;

  @ApiProperty({ description: 'Timezone del usuario', example: 'America/Mexico_City' })
  timezone: string;

  @ApiProperty({ description: 'Configuración del usuario' })
  settings: any;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Tokens de autenticación' })
  tokens: TokenPayloadDto;

  @ApiProperty({ description: 'Información del usuario' })
  user: UserDto;
}

export class MicrosoftProfileDto {
  @ApiProperty({ description: 'ID de Microsoft' })
  microsoftId: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', required: false })
  displayName?: string;

  @ApiProperty({ description: 'URL del avatar', required: false })
  avatarUrl?: string;
}
