import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, TaskStatus, TaskPriority } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto, BulkUpdateTaskDto, TaskQueryDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Crear nueva tarea
   */
  async create(userId: string, createTaskDto: CreateTaskDto) {
    this.logger.log(`Creando tarea para usuario ${userId}: ${createTaskDto.title}`);

    // Verificar que el proyecto existe y pertenece al usuario
    if (createTaskDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: createTaskDto.projectId, userId },
      });

      if (!project) {
        throw new NotFoundException('Proyecto no encontrado');
      }
    }

    // Verificar que la tarea padre existe si se proporciona
    if (createTaskDto.parentId) {
      const parentTask = await this.prisma.task.findFirst({
        where: { id: createTaskDto.parentId, userId },
      });

      if (!parentTask) {
        throw new NotFoundException('Tarea padre no encontrada');
      }
    }

    // Calcular siguiente orden si no se proporciona
    let order = createTaskDto.order ?? 0;
    if (order === 0) {
      const maxOrder = await this.prisma.task.aggregate({
        where: {
          userId,
          projectId: createTaskDto.projectId,
          parentId: createTaskDto.parentId,
        },
        _max: { order: true },
      });
      order = (maxOrder._max.order ?? -1) + 1;
    }

    // Crear tarea
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: createTaskDto.title,
        description: createTaskDto.description,
        projectId: createTaskDto.projectId,
        parentId: createTaskDto.parentId,
        priority: createTaskDto.priority || TaskPriority.NONE,
        status: createTaskDto.status || TaskStatus.PENDING,
        dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null,
        order,
        recurrence: createTaskDto.recurrence,
      },
      include: {
        project: true,
        parent: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
        reminders: true,
      },
    });

    // Log de productividad
    await this.logProductivity(userId, 'tasksCreated');

    this.logger.log(`Tarea creada: ${task.id}`);
    return task;
  }

  /**
   * Listar tareas con filtros y paginación
   */
  async findAll(userId: string, query: TaskQueryDto) {
    const {
      projectId,
      status,
      priority,
      search,
      dueDateFrom,
      dueDateTo,
      includeCompleted,
      page = 1,
      limit = 20,
    } = query;

    // Construir where clause
    const where: any = {
      userId,
      parentId: null, // Solo tareas principales por defecto
    };

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    // Si no se incluyen completadas, filtrar solo pending/in_progress
    if (!includeCompleted && !status) {
      where.status = { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] };
    }

    // Búsqueda por texto
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por fechas
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
    }

    // Contar total
    const total = await this.prisma.task.count({ where });

    // Obtener tareas con paginación
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        project: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
        reminders: true,
      },
      orderBy: [
        { order: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener tareas de hoy
   */
  async getTodayTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.task.findMany({
      where: {
        userId,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
      include: {
        project: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { order: 'asc' },
      ],
    });
  }

  /**
   * Obtener tareas próximas (7 días)
   */
  async getUpcomingTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.prisma.task.findMany({
      where: {
        userId,
        dueDate: {
          gte: today,
          lte: nextWeek,
        },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
      include: {
        project: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
      ],
    });
  }

  /**
   * Obtener detalle de tarea
   */
  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        project: true,
        parent: true,
        children: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
        reminders: true,
        attachments: true,
        outlookEvent: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return task;
  }

  /**
   * Actualizar tarea
   */
  async update(userId: string, id: string, updateTaskDto: UpdateTaskDto) {
    // Verificar que la tarea existe y pertenece al usuario
    const existingTask = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Verificar proyecto si se cambia
    if (updateTaskDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: updateTaskDto.projectId, userId },
      });

      if (!project) {
        throw new NotFoundException('Proyecto no encontrado');
      }
    }

    // Actualizar
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...updateTaskDto,
        dueDate: updateTaskDto.dueDate ? new Date(updateTaskDto.dueDate) : undefined,
        completedAt: updateTaskDto.completedAt ? new Date(updateTaskDto.completedAt) : undefined,
      },
      include: {
        project: true,
        subtasks: true,
        labels: {
          include: { label: true },
        },
        reminders: true,
      },
    });

    this.logger.log(`Tarea actualizada: ${id}`);
    return task;
  }

  /**
   * Eliminar tarea
   */
  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    this.logger.log(`Tarea eliminada: ${id}`);
  }

  /**
   * Actualización masiva
   */
  async bulkUpdate(userId: string, bulkUpdateDto: BulkUpdateTaskDto) {
    const { taskIds, status, priority, projectId } = bulkUpdateDto;

    // Verificar que todas las tareas pertenecen al usuario
    const tasks = await this.prisma.task.findMany({
      where: {
        id: { in: taskIds },
        userId,
      },
      select: { id: true },
    });

    if (tasks.length !== taskIds.length) {
      throw new ForbiddenException('Alguna(s) tarea(s) no pertenece(n) al usuario');
    }

    // Verificar proyecto si se proporciona
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId },
      });

      if (!project) {
        throw new NotFoundException('Proyecto no encontrado');
      }
    }

    // Actualizar todas las tareas
    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (projectId) updateData.projectId = projectId;

    await this.prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        userId,
      },
      data: updateData,
    });

    this.logger.log(`Actualización masiva: ${taskIds.length} tareas`);
    return { updatedCount: taskIds.length };
  }

  /**
   * Marcar tarea como completada
   */
  async completeTask(userId: string, id: string) {
    return this.update(userId, id, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Marcar tarea como pendiente
   */
  async uncompleteTask(userId: string, id: string) {
    return this.update(userId, id, {
      status: TaskStatus.PENDING,
      completedAt: null,
    });
  }

  /**
   * Log de productividad
   */
  private async logProductivity(userId: string, action: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.prisma.productivityLog.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        update: {
          tasksCreated: { increment: action === 'tasksCreated' ? 1 : 0 },
          tasksCompleted: { increment: action === 'tasksCompleted' ? 1 : 0 },
        },
        create: {
          userId,
          date: today,
          tasksCreated: action === 'tasksCreated' ? 1 : 0,
          tasksCompleted: action === 'tasksCompleted' ? 1 : 0,
          focusTime: 0,
        },
      });
    } catch (error) {
      this.logger.error('Error al loguear productividad:', error);
    }
  }
}
