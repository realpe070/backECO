import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PlanActivityDto } from './plan-activity.dto';

export interface Plan {
  id: string;
  name: string;
  description: string;
  activities: PlanActivityDto[];
  createdAt: string;
  updatedAt: string;
  status?: string;
}

export class CreatePlanDto {
  @ApiProperty({ description: 'Nombre del plan' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Descripción del plan' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Actividades del plan', type: [PlanActivityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanActivityDto)
  activities!: PlanActivityDto[];

  @ApiProperty({ description: 'Fecha de creación', required: false })
  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @ApiProperty({ description: 'Fecha de actualización', required: false })
  @IsOptional()
  @IsDateString()
  updatedAt?: string;
}

export class UpdatePlanDto extends CreatePlanDto { }
