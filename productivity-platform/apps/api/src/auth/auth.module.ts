import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';

@Module({
  imports: [
    // Passport para autenticación
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT Module con configuración dinámica
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),

    // ConfigModule para variables de entorno
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MicrosoftStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
