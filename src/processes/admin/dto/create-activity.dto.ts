import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsIn, Min, Max, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ActivityType {
  EXERCISE = 'exercise',
  MEDITATION = 'meditation',
  BREATHING = 'breathing'
}

export class CreateActivityDto {
  @ApiProperty({ description: 'Nombre de la actividad' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Descripción de la actividad' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Tiempo mínimo en segundos' })
  @IsNumber()
  @Min(10)
  @Max(300) // Increased max time limit
  minTime!: number;

  @ApiProperty({ description: 'Tiempo máximo en segundos' })
  @IsNumber()
  @Min(10)
  @Max(300) // Increased max time limit
  maxTime!: number;

  @ApiProperty({ description: 'Categoría de la actividad' })
  @IsString()
  @IsIn([
    'Visual',
    'Auditiva',
    'Cognitiva',
    'Tren Superior',
    'Tren Inferior',
    'Movilidad Articular',
    'Estiramientos Generales',
  ])
  category!: string;

  @ApiProperty({ description: 'URL del video asociado' })
  @IsString()
  @IsNotEmpty()
  videoUrl!: string;

  @ApiProperty({ description: 'Indica si el sensor está habilitado' })
  @IsBoolean()
  sensorEnabled!: boolean;

  @ApiProperty({ description: 'Fecha de creación', required: false })
  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @ApiProperty({ description: 'Fecha de actualización', required: false })
  @IsOptional()
  @IsDateString()
  updatedAt?: string;

  @ApiProperty({ description: 'Tipo de actividad', required: false })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType = ActivityType.EXERCISE;

  @ApiProperty({ description: 'Duración en segundos', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(600)
  duration?: number = 300;
}
