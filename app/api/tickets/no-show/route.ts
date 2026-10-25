import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/ticket-no-show';
export const POST=withRequestPolicy(actions.POST, {feature:'TICKETS'});
