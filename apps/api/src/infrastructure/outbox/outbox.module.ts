import { Global, Module } from '@nestjs/common';
import { OutboxWriter } from './outbox.writer';

@Global()
@Module({
  providers: [OutboxWriter],
  exports: [OutboxWriter],
})
export class OutboxModule {}
