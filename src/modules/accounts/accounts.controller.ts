import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ActiveOrg } from '../../common/decorators/active-org.decorator.js';
import { AnyAccount } from '../../common/decorators/any-account.decorator.js';
import { UserRole } from 'selfless-sdk';
import { UpdateAccountDto } from './dto/update-account.dto.js';

const READERS = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_MANAGER, UserRole.SUPERVISOR];

@Controller('accounts')
export class AccountsController {
  constructor(private svc: AccountsService) {}

  @Get('me')
  @AnyAccount()
  me(@CurrentUser() user: any) {
    return this.svc.me(user.id);
  }

  @Patch('me')
  @AnyAccount()
  updateMe(@Body() dto: UpdateAccountDto, @CurrentUser() user: any) {
    return this.svc.updateMe(user.id, dto);
  }

  @Get('me/tickets')
  @AnyAccount()
  myTickets(@CurrentUser() user: any) {
    return this.svc.myTickets(user.id);
  }

  @Get()
  @Roles(...READERS)
  findAll(@ActiveOrg() organizationId: string) {
    return this.svc.findAllForOrg(organizationId);
  }

  @Get(':id')
  @Roles(...READERS)
  findOne(@Param('id') id: string, @ActiveOrg() organizationId: string) {
    return this.svc.findOneForOrg(id, organizationId);
  }
}
