import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlanActivityDto {
    @ApiProperty({ description: 'ID de la actividad' })
    @IsString()
    @IsNotEmpty()
    activityId: string;

    @ApiProperty({ description: 'Orden de la actividad en el plan' })
    @IsNumber()
    order: number;

    constructor(activityId: string, order: number) {
        this.activityId = activityId;
        this.order = order;
    }

    toJSON() {
        return {
            activityId: this.activityId,
            order: this.order
        };
    }
}
