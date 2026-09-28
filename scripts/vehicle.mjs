import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';
import {parseCsv} from './lib/csv.mjs';

export const fields={
 assets:'name plate country timezone depot status odometer certificate_type certificate_due registration_due check_required',
 drivers:'name licence_due licence_class active',checklists:'name instructions active',checklist_items:'name checklist_id critical position',
 inspections:'name asset_id driver_id checklist_id inspected_at odometer result signed_by',
 defects:'name asset_id inspection_id component severity owner reported_at due_date',
 repairs:'name defect_id technician repaired_at evidence cost_cents currency',
 services:'name asset_id due_date due_odometer completed_at evidence',notes:'name asset_id occurred_at'
};
const refs={asset_id:'assets',driver_id:'drivers',checklist_id:'checklists',inspection_id:'inspections',defect_id:'defects'};
const ints=new Set('odometer position cost_cents due_odometer'.split(' '));
const bools=new Set('check_required active critical'.split(' '));
export const reads={
 assets:'select id,name,plate,depot,status,odometer,country from assets order by name',
 drivers:'select id,name,licence_class,licence_due,active from drivers order by name',
 checklists:'select c.name checklist,i.name item,i.critical,i.position from checklists c join checklist_items i on i.checklist_id=c.id order by c.name,i.position',
 inspections:'select i.id,a.name asset,i.name,i.inspected_at,i.result,i.signed_by,i.verified_complete from inspections i join assets a on a.id=i.asset_id order by i.inspected_at desc',
 'pre-start':'select asset,depot,status,local_day,complete_checks_today,critical_open,schedule from prestart_queue order by asset',
 defects:"select asset,defect,component,severity,owner,age_days,due_date,overdue from defect_queue where status='open' order by severity,age_days desc",
 'defects-due':"select asset,defect,severity,owner,age_days from defect_queue where status='open' and (overdue or trim(owner)='') order by age_days desc",
 'repeat-defects':"select a.name asset,d.component,count(*) occurrences,count(*) filter(where d.status='open') still_open from defects d join assets a on a.id=d.asset_id where d.reported_at>=now()-interval '90 days' group by a.id,a.name,d.component having count(*)>1 order by occurrences desc",
 repairs:'select a.name asset,d.name defect,r.technician,r.repaired_at,r.evidence,r.currency,r.cost_cents from repairs r join defects d on d.id=r.defect_id join assets a on a.id=d.asset_id order by r.repaired_at desc',
 'repair-costs':'select a.name asset,r.currency,count(*) repair_entries,sum(r.cost_cents) cost_cents from repairs r join defects d on d.id=r.defect_id join assets a on a.id=d.asset_id group by a.id,a.name,r.currency order by a.name,r.currency',
 'services-due':'select asset,service,due_date,due_odometer,odometer,distance_left,due_now from service_queue order by due_date nulls last,asset',
 certificates:"select name asset,country,certificate_type,certificate_due,registration_due from assets where status<>'retired' order by certificate_due nulls first",
 'driver-review':"select name,licence_class,licence_due from drivers where active and (licence_due is null or licence_due<=current_date+30 or trim(licence_class)='') order by licence_due nulls first",
 'depot-review':"select depot,count(*) assets,count(*) filter(where status='held') held,sum(critical_open) critical_open,sum(complete_checks_today) complete_checks_today from prestart_queue group by depot order by depot",
 'inspection-quality':"select a.name asset,i.name inspection,i.inspected_at,i.signed_by,i.verified_complete from inspections i join assets a on a.id=i.asset_id where not i.verified_complete or trim(i.signed_by)='' order by i.inspected_at desc",
 'attention':"select asset,rule,finding from compliance_findings union all select asset,'OVERDUE-DEFECT','Overdue defect: '||defect from defect_queue where status='open' and overdue union all select asset,'UNASSIGNED-DEFECT','No owner: '||defect from defect_queue where status='open' and trim(owner)=''",
 compliance:'select * from compliance_findings order by asset,rule',
 notes:'select a.name asset,n.name note,n.occurred_at from notes n join assets a on a.id=n.asset_id order by n.occurred_at desc'
};
export async function resolve(db,entity,value){
 if(!fields[entity])throw Error(`Unknown entity: ${entity}`);
 const s=String(value??'').trim();if(!s)throw Error('A name or ID is required');
 let rows=await db.query(`select * from ${entity} where id::text=$1 or lower(name)=lower($1)`,[s]);
 if(!rows.length)rows=await db.query(`select * from ${entity} where starts_with(id::text,$1) or strpos(lower(name),lower($1))>0 order by name,id`,[s]);
 if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'No match'} ${entity}: ${s}${rows.length?'\n'+rows.map(r=>r.id+' '+r.name).join('\n'):''}`);
 return rows[0];
}
function obj(text){const x=typeof text==='string'?JSON.parse(text):text;if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Expected one JSON object');return x;}
export async function write(db,entity,data,existing=null){
 if(!fields[entity])throw Error('Unknown entity '+entity);
 if(existing&&entity==='assets'){await db.query('select id from assets where id=$1 for update',[existing.id]);existing=await resolve(db,entity,existing.id);}
 const allowed=fields[entity].split(' '),values={};
 for(const [key,value] of Object.entries(obj(data))){
  if(!allowed.includes(key))throw Error(`Unknown field ${entity}.${key}`);
  let v=value;
  if(refs[key]){v=(await resolve(db,refs[key],value)).id;if(existing&&existing[key]!==v)throw Error('Cannot change parent relationships; create a reviewed replacement');}
  if(ints.has(key)&&v!==null){if(typeof v==='string'&&/^\d+$/.test(v))v=Number(v);if(!Number.isSafeInteger(v)||v<0||v>2147483647)throw Error(key+' requires a whole nonnegative integer');}
  if(bools.has(key)&&typeof v!=='boolean')throw Error(key+' requires true or false');
  if(key.endsWith('_at')&&v!==null){if(v===null||typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error(key+' requires an ISO timestamp with timezone');}
  if((key.endsWith('_due')||key==='due_date')&&v!==null){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(key+' requires YYYY-MM-DD');}
  if(v===null&&!['licence_due','certificate_due','registration_due','due_date','due_odometer','completed_at'].includes(key))throw Error(key+' cannot be null');
  if(typeof v==='string'&&['name','owner','timezone'].includes(key)&&!v.trim())throw Error(key+' cannot be blank');
  values[key]=v;
 }
 if(!Object.keys(values).length)throw Error('No fields to write');
 if(entity==='assets'&&values.timezone&&!(await db.query('select name from pg_timezone_names where name=$1',[values.timezone])).length)throw Error('Unknown timezone');
 if(existing&&['inspections','repairs'].includes(entity))throw Error('Inspection and repair evidence is append-only');
 if(entity==='assets'&&existing&&values.odometer!==undefined&&values.odometer<existing.odometer)throw Error('Odometer cannot move backwards');
 if(entity==='assets'&&existing&&values.status==='active'&&existing.status==='held')throw Error('Use release with reviewer evidence');
 if(entity==='assets'&&existing&&values.country&&values.country!==existing.country)throw Error('Review jurisdiction changes through a migration');
 if(entity==='defects'&&values.status==='closed')throw Error('Use repair to close a defect with evidence');
 if(entity==='defects'&&existing&&existing.severity==='critical'&&values.severity==='review')throw Error('Critical severity cannot be downgraded through update');
 if(entity==='defects'&&values.inspection_id){const i=await resolve(db,'inspections',values.inspection_id);if(i.asset_id!==(values.asset_id||existing?.asset_id))throw Error('Inspection belongs to another asset');}
 if(entity==='defects'){const assetId=values.asset_id||existing?.asset_id;if(assetId)await db.query('select id from assets where id=$1 for update',[assetId]);}
 const keys=Object.keys(values),params=Object.values(values);
 if(existing){params.push(existing.id);const row=(await db.query(`update ${entity} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} where id=$${params.length} returning *`,params))[0];if(entity==='defects'&&row.severity==='critical'&&row.status==='open')await db.query("update assets set status='held' where id=$1 and status<>'retired'",[row.asset_id]);return row;}
 const row=(await db.query(`insert into ${entity} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,params))[0];
 if(entity==='defects'&&row.severity==='critical')await db.query("update assets set status='held' where id=$1 and status<>'retired'",[row.asset_id]);
 return row;
}
async function transaction(db,fn,dry=false){await db.exec('BEGIN');try{const result=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function importData(db,dir,dry){
 const mapping=JSON.parse(fs.readFileSync(path.join(dir,'mapping.json'),'utf8'));
 const order=Object.keys(fields),sourceIds=new Map(),result=[];
 if(Object.keys(mapping).some(k=>!fields[k]))throw Error('Unknown entity in mapping');
 return transaction(db,async()=>{
  for(const entity of order){const spec=mapping[entity];if(!spec)continue;
   if(!spec.file||path.basename(spec.file)!==spec.file||!spec.columns||typeof spec.columns!=='object')throw Error('Mapping needs a CSV filename and columns object');
   const rows=parseCsv(fs.readFileSync(path.join(dir,spec.file),'utf8'));let added=0,skipped=0;
   if(!Object.values(spec.columns).includes('source_id'))throw Error('Map a stable source_id for '+entity);
   const mapped=Object.values(spec.columns).filter(Boolean);if(new Set(mapped).size!==mapped.length)throw Error('Duplicate mapped fields');
   for(const raw of rows){
    const unknown=Object.keys(raw).filter(k=>!(k in spec.columns));if(unknown.length)throw Error('Unmapped columns: '+unknown.join(', '));
    const missing=Object.keys(spec.columns).filter(k=>!(k in raw));if(missing.length)throw Error('Missing mapped columns: '+missing.join(', '));
    let source;const data={};
    for(const [header,key] of Object.entries(spec.columns)){
     if(key===null)continue;if(key==='source_id'){source=raw[header].trim();continue;}
     if(!fields[entity].split(' ').includes(key))throw Error('Unknown mapped field '+key);
     let v=raw[header];if(v==='')continue;
     if(refs[key]){const ref=refs[key],found=sourceIds.get(ref+':'+v)||(await db.query('select record_id from import_rows where entity=$1 and source_id=$2',[ref,v]))[0]?.record_id;if(!found)throw Error(`Missing imported reference ${ref}:${v}`);v=found;}
     if(bools.has(key)){if(!['true','false','yes','no','1','0'].includes(v.toLowerCase()))throw Error('Invalid boolean '+header);v=['true','yes','1'].includes(v.toLowerCase());}
     data[key]=v;
    }
    if(!source)throw Error('Empty source_id');
    const fingerprint=createHash('sha256').update(JSON.stringify({raw,spec})).digest('hex');
    const prior=(await db.query('select * from import_rows where entity=$1 and source_id=$2',[entity,source]))[0];
    if(prior){if(prior.fingerprint!==fingerprint)throw Error(`Changed source row ${entity}:${source}; review before replacing`);sourceIds.set(entity+':'+source,prior.record_id);skipped++;continue;}
    const row=await write(db,entity,data);sourceIds.set(entity+':'+source,row.id);
    await db.query('insert into import_rows(entity,source_id,record_id,raw_row,mapping,fingerprint) values($1,$2,$3,$4,$5,$6)',[entity,source,row.id,JSON.stringify(raw),JSON.stringify(spec),fingerprint]);added++;
   }result.push({entity,added,skipped,dry_run:dry});
  }if(!result.length)throw Error('No mapped data');return result;
 },dry);
}
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const quote=v=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';return [keys.map(quote).join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n')+'\r\n';}
export async function run(db,args){
 args=args.filter(a=>a!=='--json');const [cmd='help',...rest]=args;
 if(reads[cmd]){if(rest.length)throw Error(cmd+' takes no arguments');return db.query(reads[cmd]);}
 if(cmd==='help')return [{commands:[...Object.keys(reads),'record <entity> <name|id>','add <entity> <json>','update <entity> <name|id> <json>','log <asset> <note>','inspect <asset> <driver> <checklist> <json>','repair <defect> <json>','release <asset> <reviewer> <evidence>','import whip-around <folder> [--dry-run]','export <new-folder>','weekly-review','draft-repair <asset>','draft-handover <asset>'].join('\n'),fields:JSON.stringify(fields),notes:'Inspect JSON: {odometer,signed_by,answers:[{item,result:pass|fail,note}]}. Every checklist item is required. Repair JSON: {name,technician,evidence,cost_cents,currency}. Records are not roadworthiness certification.'}];
 if(cmd==='record'){const [entity,match]=rest;const record=await resolve(db,entity,match);if(entity!=='assets')return [record];const children={};for(const [t,f]of Object.entries(fields))if(f.split(' ').includes('asset_id'))children[t]=await db.query(`select * from ${t} where asset_id=$1 order by created_at`,[record.id]);children.repairs=await db.query('select r.* from repairs r join defects d on d.id=r.defect_id where d.asset_id=$1',[record.id]);return [{...record,children}];}
 if(cmd==='add')return transaction(db,async()=>[await write(db,rest[0],rest[1])]);
 if(cmd==='update')return transaction(db,async()=>[await write(db,rest[0],rest[2],await resolve(db,rest[0],rest[1]))]);
 if(cmd==='log')return transaction(db,async()=>{const a=await resolve(db,'assets',rest[0]);if(!rest[1]?.trim())throw Error('A note is required');return [await write(db,'notes',{asset_id:a.id,name:rest[1],occurred_at:new Date().toISOString()})];});
 if(cmd==='inspect')return transaction(db,async()=>{
  const a=await resolve(db,'assets',rest[0]);await db.query('select id from assets where id=$1 for update',[a.id]);
  const driver=await resolve(db,'drivers',rest[1]),checklist=await resolve(db,'checklists',rest[2]),data=obj(rest[3]);
  if(a.status==='retired'||!driver.active||!checklist.active)throw Error('Asset, driver and checklist must be active');
  if(Object.keys(data).some(k=>!['odometer','signed_by','answers'].includes(k)))throw Error('Unknown inspection field');
  if(!data.signed_by?.trim()||!Array.isArray(data.answers))throw Error('Signed name and answers required');
  const items=await db.query('select * from checklist_items where checklist_id=$1 order by position,id',[checklist.id]);
  if(!items.length||items.length!==data.answers.length)throw Error('Answer every checklist item exactly once');
  const seen=new Set(),answers=[];
  for(const answer of data.answers){const candidates=items.filter(i=>i.id===answer.item||i.name.toLowerCase()===String(answer.item).toLowerCase());if(candidates.length!==1)throw Error('Unknown or ambiguous checklist item');const i=candidates[0];if(seen.has(i.id)||!['pass','fail'].includes(answer.result))throw Error('Duplicate item or invalid result');seen.add(i.id);if(answer.result==='fail'&&!answer.note?.trim())throw Error('Failed items require a defect note');answers.push({item_id:i.id,item:i.name,critical:i.critical,result:answer.result,note:String(answer.note||'')});}
  const fresh=await resolve(db,'assets',a.id);if(!Number.isSafeInteger(data.odometer)||data.odometer<fresh.odometer)throw Error('Odometer must not move backwards');
  const inspection=await write(db,'inspections',{name:'Pre-start '+new Date().toISOString(),asset_id:a.id,driver_id:driver.id,checklist_id:checklist.id,odometer:data.odometer,result:answers.some(x=>x.result==='fail')?'fail':'pass',signed_by:data.signed_by});
  await db.query('update inspections set verified_complete=true,answers=$1 where id=$2',[JSON.stringify(answers),inspection.id]);
  await write(db,'assets',{odometer:data.odometer},fresh);
  for(const answer of answers.filter(x=>x.result==='fail'))await write(db,'defects',{name:answer.note,asset_id:a.id,inspection_id:inspection.id,component:answer.item,severity:answer.critical?'critical':'review'});
  return [await resolve(db,'inspections',inspection.id)];
 });
 if(cmd==='repair')return transaction(db,async()=>{
  const d=await resolve(db,'defects',rest[0]);await db.query('select id from assets where id=$1 for update',[d.asset_id]);await db.query('select id from defects where id=$1 for update',[d.id]);
  const current=await resolve(db,'defects',d.id);if(current.status!=='open')throw Error('Defect already closed');
  const data=obj(rest[1]);if('defect_id' in data||'repaired_at' in data)throw Error('Repair closure records the selected defect and current time');
  const row=await write(db,'repairs',{...data,defect_id:d.id});await db.query("update defects set status='closed',closed_at=now() where id=$1",[d.id]);return [row];
 });
 if(cmd==='release')return transaction(db,async()=>{
  const a=await resolve(db,'assets',rest[0]);await db.query('select id from assets where id=$1 for update',[a.id]);
  if((await resolve(db,'assets',a.id)).status!=='held')throw Error('Only held assets can be released');if(!rest[1]?.trim()||!rest[2]?.trim())throw Error('Reviewer and evidence required');
  if((await db.query("select id from defects where asset_id=$1 and severity='critical' and status='open'",[a.id])).length)throw Error('Open critical defects prevent release');
  await write(db,'notes',{asset_id:a.id,name:'Administrative release by '+rest[1]+': '+rest[2]});
  return await db.query("update assets set status='active' where id=$1 returning *",[a.id]);
 });
 if(cmd==='weekly-review'){const out=[];for(const c of ['pre-start','defects-due','services-due','compliance'])for(const row of await run(db,[c]))out.push({desk:c,...row});return out;}
 if(cmd==='import'){if(rest[0]!=='whip-around'||!rest[1]||rest.slice(2).some(x=>x!=='--dry-run'))throw Error('import whip-around <folder> [--dry-run]');return importData(db,path.resolve(rest[1]),rest.includes('--dry-run'));}
 if(cmd==='export'){
  if(!rest[0])throw Error('export <new-folder>');const dir=path.resolve(rest[0]);if(fs.existsSync(dir))throw Error('Export folder already exists');
  const all=await transaction(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const out={};for(const t of [...Object.keys(fields),'audit','import_rows'])out[t]=await db.query(`select * from ${t} order by id`);return out;});
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'all.json'),JSON.stringify(all,null,2)+'\n');for(const[t,rows]of Object.entries(all))fs.writeFileSync(path.join(dir,t+'.csv'),csv(rows));return Object.entries(all).map(([entity,rows])=>({entity,rows:rows.length}));
 }
 if(['draft-repair','draft-handover'].includes(cmd)){
  const a=await resolve(db,'assets',rest[0]),record=(await run(db,['record','assets',a.id]))[0];
  const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${cmd}-${a.id}-${Date.now()}.md`);
  const defects=record.children.defects.filter(d=>d.status==='open');
  fs.writeFileSync(file,`# Internal draft for review\n\n${cmd==='draft-repair'?'Repair request':'Fleet handover'}: ${a.name} (${a.plate})\n\nRecorded status: ${a.status}. Open defects: ${defects.length}.\n\n${defects.map(d=>d.severity+': '+d.name+'; owner '+(d.owner||'unassigned')).join('\n')}\n\nA competent person must review the vehicle and the evidence before use.\n\n## Source records\n\n${JSON.stringify(record,null,2)}\n`);return [{file,asset:a.name}];
 }
 throw Error('Unknown command '+cmd);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const rows=await run(db,process.argv.slice(2));if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));else console.log(table(rows,[...new Set(rows.flatMap(Object.keys))].map(key=>({key,label:key,format:(v,row)=>v instanceof Date?v.toISOString():key.endsWith('_cents')&&v!==undefined?`${row.currency||''} ${(Number(v)/100).toFixed(2)}`.trim():typeof v==='object'&&v!==null?JSON.stringify(v):v}))));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
