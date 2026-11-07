import { profileDisplayPolicy } from '@/src/lib/profile-display-policy';
const policy = profileDisplayPolicy('Pet');
export const GET = policy.GET;
export const PUT = policy.PUT;
