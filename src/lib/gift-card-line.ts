export const giftCardSource='GIFT_CARD_ISSUE:';
export const isGiftCardLine=(line:{sourceKey?:string|null})=>!!line.sourceKey?.startsWith(giftCardSource);
