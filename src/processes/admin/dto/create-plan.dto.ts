import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PlanActivityDto } from './plan-activity.dto';

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

    constructor(name: string, description: string, activities: PlanActivityDto[]) {
        this.name = name;
        this.description = description;
        this.activities = activities;
    }

    toFirestore() {
        return {
            name: this.name,
            description: this.description,
            activities: this.activities.map(activity => activity.toJSON()),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
}
