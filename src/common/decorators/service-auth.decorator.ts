import { SetMetadata } from '@nestjs/common';

export const IS_SERVICE_AUTH_KEY = 'isServiceAuth';

/**
 * Marks a route as internal-service-only, authenticated by a shared-secret header
 * (checked by ServiceAuthGuard) instead of an account JWT. JwtAuthGuard and RolesGuard
 * both treat this the same as @Public()/@AnyAccount() — a valid access policy that lets
 * the route bypass account auth and role checks entirely. Only use this for routes meant
 * to be called by trusted internal services (e.g. BullMQ workers), never ones also reachable
 * by staff/customer accounts.
 */
export const ServiceAuth = () => SetMetadata(IS_SERVICE_AUTH_KEY, true);
