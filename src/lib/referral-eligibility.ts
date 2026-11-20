import type {Prisma} from '@prisma/client';
export const paidGrooming: Prisma.TicketWhereInput = {
  status: 'CLOSED',
  payments: { some: { amount: { gt: 0 } } },
  lines: { some: { lineType: 'SERVICE', petId: { not: null }, totalCents: { gt: 0 }, OR: [
    { role: 'GROOM' },
    { service: { category: { in: ['GR', 'GROOM', 'GROOMING', 'FFT', 'FW', 'FULL WASH', 'FULL_WASH'] } } },
  ] } },
};
