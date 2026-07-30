import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class NotificationPreferenceDto {
  @ApiProperty({ default: true }) announcementsEnabled!: boolean;
  @ApiProperty({ default: true }) courseUpdatesEnabled!: boolean;
  @ApiProperty({ default: true }) learningRemindersEnabled!: boolean;
}

export class UpdateNotificationPreferenceDto {
  @ApiProperty() @IsBoolean() announcementsEnabled!: boolean;
  @ApiProperty() @IsBoolean() courseUpdatesEnabled!: boolean;
  @ApiProperty() @IsBoolean() learningRemindersEnabled!: boolean;
}
