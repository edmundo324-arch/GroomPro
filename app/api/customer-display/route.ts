import { profileDisplayPolicy } from '@/src/lib/profile-display-policy';
const policy = profileDisplayPolicy('Customer');
export const GET = policy.GET;
export const PUT = policy.PUT;
