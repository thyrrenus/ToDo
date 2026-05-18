import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Crear nuevo proyecto
   */
  async create(userId: string, createProjectDto: CreateProjectDto) {
    this.logger.log(`Creando proyecto para usuario ${userId}: ${createProjectDto.name}`);

    // Calcular siguiente orden si no se proporciona
    let order = createProjectDto.order ?? 0;
    if (order === 0) {
      const maxOrder = await this.prisma.project.aggregate({
        where: { userId },
        _max: { order: true },
      });
      order = (maxOrder._max.order ?? -1) + 1;
    }

    const project = await this.prisma.project.create({
      data: {
        userId,
        name: createProjectDto.name,
        color: createProjectDto.color || '#3B82F6',
        icon: createProjectDto.icon,
        order,
        isFavorite: createProjectDto.isFavorite ?? false,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    this.logger.log(`Proyecto creado: ${project.id}`);
    return project;
  }

  /**
   * Listar todos los proyectos del usuario
   */
  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId, isArchived: false },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: [
        { isFavorite: 'desc' },
        { order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Obtener proyectos favoritos
   */
  async getFavorites(userId: string) {
    return this.prisma.project.findMany({
      where: { userId, isFavorite: true, isArchived: false },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Obtener detalle de proyecto con tareas
   */
  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        tasks: {
          where: {
            parentId: null, // Solo tareas principales
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          include: {
            subtasks: true,
            labels: {
              include: { label: true },
            },
            reminders: true,
          },
          orderBy: [
            { order: 'asc' },
            { dueDate: 'asc' },
          ],
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return project;
  }

  /**
   * Actualizar proyecto
   */
  async update(userId: string, id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findFirst({
      where: { id, userId },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    this.logger.log(`Proyecto actualizado: ${id}`);
    return project;
  }

  /**
   * Eliminar proyecto (cascada elimina tareas asociadas)
   */
  async remove(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    await this.prisma.project.delete({
      where: { id },
    });

    this.logger.log(`Proyecto eliminado: ${id}`);
  }
}
