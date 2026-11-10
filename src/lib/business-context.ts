export const businessPrefix = 'pilot_';
export const platformUserPrefix = 'pilot_operator_';
export const businessCookie = 'groompro_tenant';
export const sessionCookie = 'groompro_session';
export const deviceCookie = 'groompro_device';
export const businessId = (id: string | undefined | null) => Boolean(id?.startsWith(businessPrefix));

export function mayOpenBusinessWithoutPin(path: string, method: string) {
  if (path === '/api/employee/session') return ['GET','POST','DELETE'].includes(method);
  if (path === '/api/setup/context') return ['GET','POST'].includes(method);
  return method === 'GET' && ['/api/ui-context','/api/platform-brand'].includes(path);
}

export const contextCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/',
});
