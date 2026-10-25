import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/ticket-checkout';
export const GET=withRequestPolicy(actions.GET, {feature:'TICKETS'});
export const POST=withRequestPolicy(actions.POST, {feature:'TICKETS'});
