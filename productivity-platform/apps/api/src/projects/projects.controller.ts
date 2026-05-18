import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo proyecto' })
  @ApiResponse({ status: 201, description: 'Proyecto creado exitosamente' })
  async create(@Request() req, @Body() createProjectDto: CreateProjectDto) {
    const userId = req.user.sub;
    const project = await this.projectsService.create(userId, createProjectDto);
    return {
      success: true,
      data: project,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de proyectos obtenida exitosamente' })
  async findAll(@Request() req) {
    const userId = req.user.sub;
    const projects = await this.projectsService.findAll(userId);
    return {
      success: true,
      data: projects,
    };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Obtener proyectos favoritos' })
  @ApiResponse({ status: 200, description: 'Proyectos favoritos obtenidos exitosamente' })
  async getFavorites(@Request() req) {
    const userId = req.user.sub;
    const projects = await this.projectsService.getFavorites(userId);
    return {
      success: true,
      data: projects,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de proyecto con tareas' })
  @ApiResponse({ status: 200, description: 'Proyecto obtenido exitosamente' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    const project = await this.projectsService.findOne(userId, id);
    return {
      success: true,
      data: project,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto actualizado exitosamente' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const userId = req.user.sub;
    const project = await this.projectsService.update(userId, id, updateProjectDto);
    return {
      success: true,
      data: project,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar proyecto' })
  @ApiResponse({ status: 204, description: 'Proyecto eliminado exitosamente' })
  async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const userId = req.user.sub;
    await this.projectsService.remove(userId, id);
    return {
      success: true,
      message: 'Proyecto eliminado correctamente',
    };
  }
}
