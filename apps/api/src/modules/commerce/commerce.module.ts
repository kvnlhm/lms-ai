import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CommerceService } from './application/commerce.service';
import { ActivationNotifierService } from './infrastructure/activation-notifier.service';
import { MidtransService } from './infrastructure/midtrans.service';
import { CommerceController } from './presentation/controllers/commerce.controller';
import { CheckoutRateLimiter } from './application/checkout-rate-limiter';
import { PaidMembershipAccessService } from './application/paid-membership-access.service';

@Module({
  imports: [IdentityModule],
  controllers: [CommerceController],
  providers: [
    CommerceService,
    CheckoutRateLimiter,
    MidtransService,
    ActivationNotifierService,
    PaidMembershipAccessService,
  ],
  exports: [PaidMembershipAccessService],
})
export class CommerceModule {}
