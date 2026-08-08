import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CommerceService } from './application/commerce.service';
import { ActivationNotifierService } from './infrastructure/activation-notifier.service';
import { MidtransService } from './infrastructure/midtrans.service';
import { CommerceController } from './presentation/controllers/commerce.controller';
import { CheckoutRateLimiter } from './application/checkout-rate-limiter';
import { PaidMembershipAccessService } from './application/paid-membership-access.service';
import { MembershipAccessService } from './application/membership-access.service';
import { MEMBERSHIP_ACCESS } from '../../shared/access/membership.port';

@Module({
  imports: [IdentityModule],
  controllers: [CommerceController],
  providers: [
    CommerceService,
    CheckoutRateLimiter,
    MidtransService,
    ActivationNotifierService,
    PaidMembershipAccessService,
    // Hak akses berbayar tinggal di modul ini karena tabelnya di sini; modul
    // lain menanyakannya lewat port, bukan membaca tabelnya (ADR-032).
    { provide: MEMBERSHIP_ACCESS, useClass: MembershipAccessService },
  ],
  exports: [PaidMembershipAccessService, MEMBERSHIP_ACCESS],
})
export class CommerceModule {}
