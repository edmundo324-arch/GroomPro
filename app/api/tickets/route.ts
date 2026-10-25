import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/ticket-booking';
export const POST=withRequestPolicy(actions.POST, {feature:'TICKETS'});
export const PATCH=withRequestPolicy(actions.PATCH, {feature:'TICKETS'});
