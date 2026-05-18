import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Obtener estadísticas generales del dashboard
   */
  async getDashboardStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Tareas pendientes totales
    const totalPending = await this.prisma.task.count({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Tareas de hoy
    const todayTasks = await this.prisma.task.count({
      where: {
        userId,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Tareas próximas (7 días)
    const upcomingTasks = await this.prisma.task.count({
      where: {
        userId,
        dueDate: {
          gte: tomorrow,
          lte: nextWeek,
        },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Tareas completadas esta semana
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const completedThisWeek = await this.prisma.task.count({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: {
          gte: lastWeek,
        },
      },
    });

    // Proyectos activos
    const activeProjects = await this.prisma.project.count({
      where: {
        userId,
        isArchived: false,
      },
    });

    // Productividad últimos 7 días
    const productivityLogs = await this.prisma.productivityLog.findMany({
      where: {
        userId,
        date: {
          gte: lastWeek,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calcular streak (rachas de días productivos)
    const streak = this.calculateStreak(productivityLogs);

    return {
      totalPending,
      todayTasks,
      upcomingTasks,
      completedThisWeek,
      activeProjects,
      streak,
      productivityData: productivityLogs.map((log) => ({
        date: log.date,
        tasksCompleted: log.tasksCompleted,
        focusTime: log.focusTime,
      })),
    };
  }

  /**
   * Calcular racha de días productivos
   */
  private calculateStreak(logs: any[]): number {
    if (logs.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar si hoy ya tiene actividad
    const hasToday = logs.some(
      (log) =>
        log.date.toDateString() === today.toDateString() &&
        (log.tasksCompleted > 0 || log.tasksCreated > 0),
    );

    if (!hasToday) {
      // Verificar ayer para continuar racha
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const hasYesterday = logs.some(
        (log) =>
          log.date.toDateString() === yesterday.toDateString() &&
          (log.tasksCompleted > 0 || log.tasksCreated > 0),
      );

      if (!hasYesterday) {
        return 0; // Racha rota
      }
    }

    // Contar días consecutivos
    for (let i = 0; i < logs.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      const hasDay = logs.some(
        (log) =>
          log.date.toDateString() === expectedDate.toDateString() &&
          (log.tasksCompleted > 0 || log.tasksCreated > 0),
      );

      if (hasDay) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Obtener tareas por prioridad
   */
  async getTasksByPriority(userId: string) {
    const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
    const result: any = {};

    for (const priority of priorities) {
      result[priority] = await this.prisma.task.count({
        where: {
          userId,
          priority: priority as any,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });
    }

    return result;
  }

  /**
   * Obtener actividades recientes
   */
  async getRecentActivity(userId: string, limit: number = 10) {
    const recentTasks = await this.prisma.task.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        project: true,
      },
    });

    return recentTasks.map((task) => ({
      id: task.id,
      title: task.title,
      action: task.status === 'COMPLETED' ? 'completed' : 'updated',
      projectId: task.projectId,
      projectName: task.project?.name,
      timestamp: task.updatedAt,
    }));
  }
}
