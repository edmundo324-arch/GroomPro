// Transfers change only the current family. Tickets and charges keep their original customer.
export async function transferPet(tx:any,tenantId:string,actorUserId:string,input:{petId:string;customerId:string;newCustomerId:string}){
 const {petId,customerId,newCustomerId}=input;
 if(!petId||!customerId||!newCustomerId||customerId===newCustomerId)throw Error('Choose a different family for this pet.');
 await tx.$queryRaw`SELECT id FROM Pet WHERE id=${petId} AND tenantId=${tenantId} FOR UPDATE`;
 const pet=await tx.pet.findFirst({where:{id:petId,tenantId,customerId}});
 if(!pet)throw Error('This pet’s family has changed. Reopen the pet before transferring.');
 const owner=await tx.customer.findFirst({where:{id:newCustomerId,tenantId,active:true}});
 if(!owner)throw Error('Choose an active customer you can access in this business.');
 const changed=await tx.pet.updateMany({where:{id:petId,tenantId,customerId},data:{customerId:newCustomerId}});
 if(changed.count!==1)throw Error('This pet’s family has changed. Reopen the pet before transferring.');
 await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId,entityType:'PET',entityId:petId,customerId:newCustomerId,action:'TRANSFER',summary:`Transferred ${pet.name} to ${owner.firstName} ${owner.lastName}.`,details:{previousCustomerId:customerId,newCustomerId}}});
 return tx.pet.findFirst({where:{id:petId,tenantId},include:{vaccinations:true}});
}
