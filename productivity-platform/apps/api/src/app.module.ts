import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { CalendarModule } from './calendar/calendar.module';
import { OutlookModule } from './outlook/outlook.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // Configuración - Cargar variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting - Prevenir abusos
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 60, // 60 requests por minuto
      },
      {
        ttl: 3600000, // 1 hora
        limit: 1000, // 1000 requests por hora
      },
    ]),

    // Schedule - Tareas programadas (recordatorios, sync Outlook)
    ScheduleModule.forRoot(),

    // Módulos de la aplicación
    AuthModule,
    TasksModule,
    ProjectsModule,
    CalendarModule,
    OutlookModule,
    DashboardModule,
  ],
})
export class AppModule {}
