import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsUUID,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ description: 'Título de la tarea', example: 'Completar informe mensual' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción detallada', example: 'Informe de ventas del mes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'ID del proyecto',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ 
    description: 'ID de la tarea padre (para subtareas)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ 
    description: 'Prioridad',
    enum: TaskPriority,
    default: TaskPriority.NONE,
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.NONE;

  @ApiPropertyOptional({ 
    description: 'Estado',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus = TaskStatus.PENDING;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Orden en la lista', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number = 0;

  @ApiPropertyOptional({ 
    description: 'Configuración de recurrencia',
    example: { frequency: 'WEEKLY', interval: 1, daysOfWeek: [1, 3, 5] },
  })
  @IsOptional()
  recurrence?: any;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Título de la tarea' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Descripción detallada' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'ID del proyecto' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Prioridad', enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Estado', enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de completado' })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Orden en la lista' })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'Configuración de recurrencia' })
  @IsOptional()
  recurrence?: any;
}

export class BulkUpdateTaskDto {
  @ApiProperty({ description: 'IDs de tareas a actualizar', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  taskIds: string[];

  @ApiPropertyOptional({ description: 'Nuevo estado', enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Nueva prioridad', enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Nuevo proyecto' })
  @IsUUID()
  @IsOptional()
  projectId?: string;
}

export class TaskQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por proyecto' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Filtrar por prioridad', enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Buscar por título/descripción' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento desde' })
  @IsDateString()
  @IsOptional()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento hasta' })
  @IsDateString()
  @IsOptional()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Incluir completadas', default: false })
  @IsBoolean()
  @IsOptional()
  includeCompleted?: boolean = false;

  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items por página', default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
