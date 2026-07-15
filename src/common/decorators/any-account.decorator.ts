import { SetMetadata } from '@nestjs/common';

export const IS_ANY_ACCOUNT_KEY = 'isAnyAccount';

/** Marks a route as open to any authenticated account regardless of role (e.g. a customer viewing their own ticket). */
export const AnyAccount = () => SetMetadata(IS_ANY_ACCOUNT_KEY, true);
