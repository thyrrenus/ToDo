import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto, BulkUpdateTaskDto, TaskQueryDto } from './dto/create-task.dto';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nueva tarea' })
  @ApiResponse({ status: 201, description: 'Tarea creada exitosamente' })
  async create(@Request() req, @Body() createTaskDto: CreateTaskDto) {
    const userId = req.user.sub;
    const task = await this.tasksService.create(userId, createTaskDto);
    return {
      success: true,
      data: task,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar tareas con filtros' })
  @ApiResponse({ status: 200, description: 'Lista de tareas obtenida exitosamente' })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Request() req, @Query() query: TaskQueryDto) {
    const userId = req.user.sub;
    const tasks = await this.tasksService.findAll(userId, query);
    return {
      success: true,
      ...tasks,
    };
  }

  @Get('today')
  @ApiOperation({ summary: 'Obtener tareas de hoy' })
  @ApiResponse({ status: 200, description: 'Tareas de hoy obtenidas exitosamente' })
  async getTodayTasks(@Request() req) {
    const userId = req.user.sub;
    const tasks = await this.tasksService.getTodayTasks(userId);
    return {
      success: true,
      data: tasks,
    };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Obtener tareas próximas (7 días)' })
  @ApiResponse({ status: 200, description: 'Tareas próximas obtenidas exitosamente' })
  async getUpcomingTasks(@Request() req) {
    const userId = req.user.sub;
    const tasks = await this.tasksService.getUpcomingTasks(userId);
    return {
      success: true,
      data: tasks,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de tarea' })
  @ApiResponse({ status: 200, description: 'Tarea obtenida exitosamente' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    const task = await this.tasksService.findOne(userId, id);
    return {
      success: true,
      data: task,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar tarea' })
  @ApiResponse({ status: 200, description: 'Tarea actualizada exitosamente' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const userId = req.user.sub;
    const task = await this.tasksService.update(userId, id, updateTaskDto);
    return {
      success: true,
      data: task,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar tarea' })
  @ApiResponse({ status: 204, description: 'Tarea eliminada exitosamente' })
  async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    await this.tasksService.remove(userId, id);
    return {
      success: true,
      message: 'Tarea eliminada correctamente',
    };
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualización masiva de tareas' })
  @ApiResponse({ status: 200, description: 'Tareas actualizadas exitosamente' })
  async bulkUpdate(@Request() req, @Body() bulkUpdateDto: BulkUpdateTaskDto) {
    const userId = req.user.sub;
    const result = await this.tasksService.bulkUpdate(userId, bulkUpdateDto);
    return {
      success: true,
      data: result,
    };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar tarea como completada' })
  @ApiResponse({ status: 200, description: 'Tarea completada exitosamente' })
  async completeTask(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    const task = await this.tasksService.completeTask(userId, id);
    return {
      success: true,
      data: task,
    };
  }

  @Post(':id/uncomplete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar tarea como pendiente' })
  @ApiResponse({ status: 200, description: 'Tarea marcada como pendiente' })
  async uncompleteTask(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    const task = await this.tasksService.uncompleteTask(userId, id);
    return {
      success: true,
      data: task,
    };
  }
}
