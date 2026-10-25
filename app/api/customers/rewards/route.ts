import {withRequestPolicy} from '@/src/lib/request-policy';
import * as actions from '@/src/lib/actions/customer-rewards';
export const GET=withRequestPolicy(actions.GET, {feature:'CUSTOMERS'});
export const POST=withRequestPolicy(actions.POST, {feature:'CUSTOMERS'});
export const PATCH=withRequestPolicy(actions.PATCH, {feature:'CUSTOMERS'});
export const DELETE=withRequestPolicy(actions.DELETE, {feature:'CUSTOMERS'});
