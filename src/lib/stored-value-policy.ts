export const storedValuePolicyKey='STORED_VALUE_POLICY';
export const defaultStoredValuePolicy={revision:0,cashRefundsEnabled:false,giftCardsRefundable:false,prepaidRefundable:false};
export async function readStoredValuePolicy(tx:any,tenantId:string){const row=await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:storedValuePolicyKey}}});return {...defaultStoredValuePolicy,...(row?.value||{})};}
