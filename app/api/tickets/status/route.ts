import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/ticket-status';
export const PATCH=withRequestPolicy(actions.PATCH, {feature:'TICKETS'});
