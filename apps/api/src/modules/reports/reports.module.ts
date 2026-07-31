import { Module } from '@nestjs/common';
import { ReportService } from './application/report.service';
import { ReportsController } from './presentation/reports.controller';

/** Ekspor laporan CSV (PRD 9). */
@Module({
  controllers: [ReportsController],
  providers: [ReportService],
})
export class ReportsModule {}
