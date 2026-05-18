import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ description: 'Nombre del proyecto', example: 'Trabajo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Color del proyecto', example: '#3B82F6' })
  @IsString()
  @IsOptional()
  color?: string = '#3B82F6';

  @ApiPropertyOptional({ description: 'Icono del proyecto', example: '💼' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Orden en la lista', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number = 0;

  @ApiPropertyOptional({ description: 'Marcar como favorito', default: false })
  @IsBoolean()
  @IsOptional()
  isFavorite?: boolean = false;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Nombre del proyecto' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Color del proyecto' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Icono del proyecto' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Orden en la lista' })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'Marcar como favorito' })
  @IsBoolean()
  @IsOptional()
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Archivar proyecto' })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
