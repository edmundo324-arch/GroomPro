import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { managerAction } from './protected-action';
import { withRequestPolicy } from './request-policy';
import { customerColumns, petColumns, customerDefaultColumns, petDefaultColumns, validProfileColumns } from './profile-display-fields';

export function profileColumns(model: 'Customer' | 'Pet') {
  const base = model === 'Customer' ? customerColumns : petColumns;
  const scalar = Prisma.dmmf.datamodel.models.find(entry => entry.name === model)?.fields || [];
  const internal = new Set(['id', 'tenantId', 'customerId', 'documentFolder', 'pictureGuid', 'importSourceId']);
  return [...base, ...scalar.filter(field =>
    ['scalar', 'enum'].includes(field.kind) && !field.isList && !internal.has(field.name) && !base.some(column => column.key === field.name)
  ).map(field => ({
    key: field.name, type: field.type,
    label: field.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase())
      .replace(/Cents$/, '($)').replace(/ Pct$/, ' (%)').replace(/ Id$/, ' ID'),
  }))];
}

export function profileDisplayPolicy(model: 'Customer' | 'Pet') {
  const customer = model === 'Customer';
  const options = profileColumns(model);
  const defaults = customer ? customerDefaultColumns : petDefaultColumns;
  const settingKey = customer ? 'CUSTOMER_DISPLAY' : 'PET_DISPLAY';
  const tenant = (request: NextRequest) => request.headers.get('x-tenant-id') ||
    request.cookies.get('groompro_tenant')?.value || process.env.GROOMPRO_DEV_TENANT_ID || '';
  const feature = customer ? 'CUSTOMERS' : 'PETS';
  const GET = withRequestPolicy(async request => {
    const tenantId = tenant(request);
    if (!tenantId) return NextResponse.json({ error: 'Business context required.' }, { status: 401 });
    const entry = await db.tenantSetting.findUnique({ where: { tenantId_settingKey: { tenantId, settingKey } } });
    const fields = Array.isArray(entry?.value) ? entry.value.filter(key => options.some(column => column.key === key)) : defaults;
    return NextResponse.json({ fields, options });
  }, { feature });
  const PUT = withRequestPolicy(managerAction(async request => {
    const tenantId = tenant(request);
    const input = await request.json().catch(() => null);
    if (!validProfileColumns(input?.fields, options)) return NextResponse.json({ error: 'Choose valid display fields.' }, { status: 400 });
    const key = { tenantId, settingKey };
    await db.tenantSetting.upsert({ where: { tenantId_settingKey: key }, create: { ...key, value: input.fields }, update: { value: input.fields } });
    return NextResponse.json({ fields: input.fields, options });
  }), { feature, configure: true });
  return { GET, PUT };
}
