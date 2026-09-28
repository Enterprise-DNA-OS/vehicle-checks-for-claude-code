create table assets (
 id uuid primary key default gen_random_uuid(), name text not null unique check(trim(name)<>''), plate text not null default '', country text not null default 'NZ' check(country in ('NZ','AU')), timezone text not null default 'Pacific/Auckland', depot text not null default '', status text not null default 'active' check(status in ('active','held','retired')), odometer integer not null default 0 check(odometer>=0), certificate_type text not null default 'CoF' check(certificate_type in ('CoF','WoF','AU inspection','not applicable')), certificate_due date, registration_due date, check_required boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table drivers (
 id uuid primary key default gen_random_uuid(), name text not null check(trim(name)<>''), licence_due date, licence_class text not null default '', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table checklists (
 id uuid primary key default gen_random_uuid(), name text not null unique, instructions text not null default '', active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table checklist_items (
 id uuid primary key default gen_random_uuid(), name text not null, checklist_id uuid not null references checklists(id), critical boolean not null default false, position integer not null default 0, unique(checklist_id,name), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table inspections (
 id uuid primary key default gen_random_uuid(), name text not null, asset_id uuid not null references assets(id), driver_id uuid references drivers(id), checklist_id uuid references checklists(id), inspected_at timestamptz not null default now(), odometer integer not null check(odometer>=0), result text not null check(result in ('pass','fail','unknown')), signed_by text not null default '', verified_complete boolean not null default false, answers jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table defects (
 id uuid primary key default gen_random_uuid(), name text not null, asset_id uuid not null references assets(id), inspection_id uuid references inspections(id), component text not null default 'Other', severity text not null default 'review' check(severity in ('critical','review')), status text not null default 'open' check(status in ('open','closed')), owner text not null default '', reported_at timestamptz not null default now(), due_date date, closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check((status='closed' and closed_at is not null) or (status='open' and closed_at is null))
);
create table repairs (
 id uuid primary key default gen_random_uuid(), name text not null, defect_id uuid not null references defects(id), technician text not null check(trim(technician)<>''), repaired_at timestamptz not null default now(), evidence text not null check(trim(evidence)<>''), cost_cents integer not null default 0 check(cost_cents>=0), currency text not null default 'NZD' check(currency in ('NZD','AUD')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table services (
 id uuid primary key default gen_random_uuid(), name text not null, asset_id uuid not null references assets(id), due_date date, due_odometer integer check(due_odometer>=0), completed_at timestamptz, evidence text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(due_date is not null or due_odometer is not null), check(completed_at is null or trim(evidence)<>'')
);
create table notes (
 id uuid primary key default gen_random_uuid(), name text not null, asset_id uuid not null references assets(id), occurred_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit (
 id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null, operation text not null, before_row jsonb, after_row jsonb, created_at timestamptz not null default now()
);
create table import_rows (
 id uuid primary key default gen_random_uuid(), entity text not null, source_id text not null, record_id uuid not null, raw_row jsonb not null, mapping jsonb not null, fingerprint text not null, created_at timestamptz not null default now(), unique(entity,source_id)
);
create function stamp() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create function audit_write() returns trigger language plpgsql as $$ begin insert into audit(entity,record_id,operation,before_row,after_row) values(TG_TABLE_NAME,coalesce(new.id,old.id),TG_OP,to_jsonb(old),to_jsonb(new)); return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['assets','drivers','checklists','checklist_items','inspections','defects','repairs','services','notes'] loop
 execute format('create trigger stamp before update on %I for each row execute function stamp()',t);
 execute format('create trigger audit_write after insert or update or delete on %I for each row execute function audit_write()',t);
 end loop; end $$;
create view prestart_queue as
select a.id,a.name asset,a.depot,a.status,(now() at time zone a.timezone)::date local_day,
 (select max(i.inspected_at) from inspections i where i.asset_id=a.id) last_recorded,
 (select count(*) from inspections i where i.asset_id=a.id and i.verified_complete and (i.inspected_at at time zone a.timezone)::date=(now() at time zone a.timezone)::date) complete_checks_today,
 (select count(*) from defects d where d.asset_id=a.id and d.status='open' and d.severity='critical') critical_open,
 case when a.check_required then 'Check required' else 'Not scheduled for daily check' end schedule
from assets a where a.status<>'retired';
create view defect_queue as
select d.id,d.asset_id,a.name asset,a.depot,d.name defect,d.component,d.severity,d.status,d.owner,d.reported_at,d.due_date,
 ((now() at time zone a.timezone)::date-(d.reported_at at time zone a.timezone)::date) age_days,
 (d.due_date<(now() at time zone a.timezone)::date) overdue
from defects d join assets a on a.id=d.asset_id;
create view service_queue as
select s.id,s.asset_id,a.name asset,s.name service,s.due_date,s.due_odometer,a.odometer,
 (s.due_odometer-a.odometer) distance_left,
 (s.due_date<=(now() at time zone a.timezone)::date or s.due_odometer<=a.odometer) due_now
from services s join assets a on a.id=s.asset_id where s.completed_at is null and a.status<>'retired';
create view compliance_findings as
select a.name asset,'NZ-CERTIFICATE' rule,'Record a current '||a.certificate_type||' expiry' finding from assets a where a.status<>'retired' and a.country='NZ' and a.certificate_type in ('WoF','CoF') and (a.certificate_due is null or a.certificate_due<(now() at time zone a.timezone)::date)
union all select a.name,'CERTIFICATE-REVIEW','Review the applicable vehicle inspection requirement' from assets a where a.status<>'retired' and (a.certificate_type='AU inspection' or (a.country='NZ' and a.certificate_type='not applicable')) and (a.certificate_due is null or a.certificate_due<(now() at time zone a.timezone)::date)
union all select a.name,'REGISTRATION','Registration date missing or expired' from assets a where a.status<>'retired' and (a.registration_due is null or a.registration_due<(now() at time zone a.timezone)::date)
union all select p.asset,'DAILY-CHECK','No complete check recorded on the asset local day' from prestart_queue p join assets a on a.id=p.id where a.check_required and p.complete_checks_today=0
union all select asset,'CRITICAL-DEFECT','Open critical defect: '||defect from defect_queue where status='open' and severity='critical'
union all select a.name,'SERVICE-DUE','Service threshold reached: '||s.service from service_queue s join assets a on a.id=s.asset_id where s.due_now
union all select name,'DRIVER-EVIDENCE','Driver licence date or class missing, or licence date expired' from drivers where active and (licence_due is null or licence_due<current_date or trim(licence_class)='');
