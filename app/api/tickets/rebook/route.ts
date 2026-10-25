import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/ticket-rebooking';
export const POST=withRequestPolicy(actions.POST, {feature:'TICKETS'});
