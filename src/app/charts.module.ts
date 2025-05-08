// src/app/charts.module.ts
import { NgModule } from '@angular/core';
import { NgChartsModule } from 'ng2-charts'; // Correct import name

@NgModule({
  imports: [NgChartsModule],
  exports: [NgChartsModule],
})
export class ChartModule {}
