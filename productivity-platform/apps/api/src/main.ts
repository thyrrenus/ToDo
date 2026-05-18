import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Crear aplicación con configuración de CORS para el frontend
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configuración desde .env
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

  // Seguridad - Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Deshabilitado para desarrollo
    crossOriginEmbedderPolicy: false,
  }));

  // CORS - Permitir frontend
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Cookie parser para sesiones
  app.use(cookieParser());

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Eliminar propiedades no definidas en DTO
      forbidNonWhitelisted: true, // Lanzar error si hay propiedades no definidas
      transform: true, // Transformar payloads a instancias de clases
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: false,
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Productivity Platform API')
    .setDescription('API REST para la plataforma de productividad con integración Outlook Calendar')
    .setVersion('1.0')
    .addTag('auth', 'Autenticación con Microsoft OAuth')
    .addTag('tasks', 'Gestión de tareas')
    .addTag('projects', 'Gestión de proyectos')
    .addTag('labels', 'Etiquetas y categorías')
    .addTag('reminders', 'Recordatorios y notificaciones')
    .addTag('calendar', 'Calendario integrado')
    .addTag('outlook', 'Integración con Outlook Calendar')
    .addTag('dashboard', 'Dashboard y estadísticas')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Graceful shutdown
  const shutdownSignal = async (signal: string) => {
    logger.log(`Señal ${signal} recibida. Iniciando apagado graceful...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdownSignal('SIGTERM'));
  process.on('SIGINT', () => shutdownSignal('SIGINT'));

  // Iniciar servidor
  await app.listen(port);
  logger.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger: http://localhost:${port}/docs`);
  logger.log(`🔗 Frontend URL permitida: ${frontendUrl}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar la aplicación:', err);
  process.exit(1);
});
