const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
 const cols=await p.$queryRawUnsafe(`select table_name,column_name from information_schema.columns where table_schema='public' and table_name like 'sub_%' and column_name in ('jiIntakeWeight','jiReceivedFrom','jiReceivingDate','jiProcessingFor','intakeDate','harvestFarm','processingFor','intakeWeight','receivingDate','abaloneShellsIntakeDate')`);
 let tot=0,nonnull=0;const tabs=new Set();
 for(const c of cols){tabs.add(c.table_name);const r=await p.$queryRawUnsafe(`select count(*)::int n, count("${c.column_name}")::int nn from "${c.table_name}"`);tot+=r[0].n;nonnull+=r[0].nn;}
 console.log('columns',cols.length,'tables',tabs.size,'non-null values',nonnull);
 const r=await p.$queryRawUnsafe(`select count(*)::int n, count(distinct "jobNo")::int jobs from sub_abalone_receiving`);console.log('receiving',r);
 await p.$disconnect();
})();
