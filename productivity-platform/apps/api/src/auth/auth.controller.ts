import { 
  Controller, 
  Get, 
  Post, 
  UseGuards, 
  Request, 
  Response, 
  Body, 
  HttpCode, 
  HttpStatus,
  Query,
  Redirect,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';
import { RefreshTokenDto } from './dto/auth.dto';
import { AuthResponseDto, UserDto } from './dto/token-payload.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ 
    summary: 'Iniciar autenticación con Microsoft OAuth',
    description: 'Redirige al usuario a la página de login de Microsoft. Requiere tener configuradas las variables de entorno de Microsoft OAuth.'
  })
  @ApiResponse({ status: 302, description: 'Redirige a Microsoft login' })
  microsoftLogin() {
    // El guard redirige automáticamente a Microsoft
    // No se requiere implementación adicional
  }

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  @ApiOperation({ 
    summary: 'Callback de Microsoft OAuth',
    description: 'Endpoint de callback que recibe la respuesta de Microsoft después de la autenticación.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Autenticación exitosa - Redirige al frontend con tokens',
  })
  @Redirect()
  async microsoftCallback(@Request() req, @Query() query: any) {
    // MicrosoftAuthGuard ya validó y retornó el usuario con tokens
    const user = req.user;

    if (!user || !user.accessToken) {
      this.handleError('Error en autenticación');
    }

    // Redirigir al frontend con tokens en hash (más seguro que query params)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Usar hash fragment para mayor seguridad (no se envía al servidor)
    const redirectUrl = `${frontendUrl}/auth/callback#${this.buildHashFragment(user)}`;
    
    return { url: redirectUrl };
  }

  /**
   * Construir fragmento hash para pasar datos al frontend de forma segura
   */
  private buildHashFragment(user: any): string {
    const params = new URLSearchParams({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expires_in: user.expiresIn.toString(),
      token_type: user.tokenType,
      user_id: user.id,
      email: user.email,
    });
    return params.toString();
  }

  /**
   * Manejo de errores de autenticación
   */
  private handleError(message: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorParams = new URLSearchParams({
      error: 'authentication_failed',
      error_description: message,
    });
    throw new Error(`${frontendUrl}/auth/error?${errorParams.toString()}`);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Obtiene un nuevo access token usando un refresh token válido.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tokens refreshados exitosamente',
    schema: {
      example: {
        success: true,
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 604800,
        tokenType: 'Bearer',
      }
    }
  })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(refreshTokenDto.refreshToken);
    return {
      success: true,
      ...tokens,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cerrar sesión',
    description: 'Invalida la sesión actual del usuario. En producción, implementar blacklist de tokens con Redis.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout exitoso',
    schema: {
      example: {
        success: true,
        message: 'Sesión cerrada correctamente',
      }
    }
  })
  async logout(@Request() req) {
    const userId = req.user.sub;
    await this.authService.logout(userId);
    return {
      success: true,
      message: 'Sesión cerrada correctamente',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener perfil del usuario actual',
    description: 'Retorna la información completa del usuario autenticado, incluyendo proyectos y estado de conexión con Outlook.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Perfil obtenido exitosamente',
    type: UserDto,
  })
  async getProfile(@Request() req) {
    const userId = req.user.sub;
    const profile = await this.authService.getUserProfile(userId);
    
    return {
      success: true,
      user: profile,
    };
  }

  @Get('outlook/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Verificar estado de conexión con Outlook',
    description: 'Retorna el estado de la conexión con Outlook Calendar y los scopes autorizados.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado de Outlook obtenido exitosamente',
    schema: {
      example: {
        success: true,
        connected: true,
        expiresAt: '2024-12-31T23:59:59Z',
        scopes: ['User.Read', 'Calendars.ReadWrite', 'offline_access'],
        isExpired: false,
      }
    }
  })
  async getOutlookStatus(@Request() req) {
    const userId = req.user.sub;
    const profile = await this.authService.getUserProfile(userId);
    
    const outlookToken = profile.outlookTokens?.[0];
    const isConnected = !!outlookToken;
    const isExpired = outlookToken ? new Date(outlookToken.expiresAt) < new Date() : false;
    
    return {
      success: true,
      connected: isConnected,
      expiresAt: outlookToken?.expiresAt,
      scopes: outlookToken?.scopes || [],
      isExpired,
    };
  }
}
