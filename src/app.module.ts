import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { StockFlowConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), StockFlowConfigModule, DatabaseModule, AuthModule, ProductsModule, InvoicesModule],
  controllers: [HealthController],
})
export class AppModule {}
