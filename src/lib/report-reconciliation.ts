export function reportReconciliation(payments:any[],closed:any[],settlements:any[]){
 const paymentIds=new Set(payments.map(p=>p.id));
 const collectedCents=payments.reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0);
 const balancePaymentsCents=settlements.filter(s=>paymentIds.has(s.referenceId)&&s.entryType==='OWED'&&s.amountCents<0).reduce((sum,s)=>sum-s.amountCents,0);
 let closedLineCents=0,closedBalanceLinesCents=0;
 for(const ticket of closed)for(const line of ticket.lines||[]){closedLineCents+=line.totalCents;if(/^Customer Account Balance$/i.test(line.description))closedBalanceLinesCents+=line.totalCents;}
 return {collectedCents,balancePaymentsCents,otherPaymentsCents:collectedCents-balancePaymentsCents,closedLineCents,closedBalanceLinesCents,closedLinesExcludingBalancesCents:closedLineCents-closedBalanceLinesCents};
}
export const reconciliationMeasures=[['Payments collected','collectedCents'],['Payments recorded against prior customer balances','balancePaymentsCents'],['Other recorded payments (including tax and tips)','otherPaymentsCents'],['Closed-ticket line totals','closedLineCents'],['Prior-balance lines on closed tickets','closedBalanceLinesCents'],['Closed-ticket lines excluding prior balances','closedLinesExcludingBalancesCents']] as const;
