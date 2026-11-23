alter table gallery_internal.visits add column listening boolean not null default false;
create table gallery_internal.voice_budget(day date primary key,packets integer not null,bytes bigint not null);
revoke all on gallery_internal.voice_budget from public,anon,authenticated;
create or replace function public.gallery_can_hear(channel_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from gallery_internal.visits where actor=auth.uid() and expires_at>now() and 'voice:'||peer=channel_name)
$$;
create or replace function public.gallery_voice(lease uuid,operation text,packet text default '') returns boolean language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits; stamp timestamptz:=clock_timestamp();
begin
 select * into strict v from gallery_internal.visits where ticket=lease and actor=auth.uid() and expires_at>stamp for update;
 if operation in('listen','mute') then update gallery_internal.visits set listening=operation='listen' where ticket=lease;return true;end if;
 if operation='end' then update gallery_internal.visits set voice_until=null where ticket=lease;return true;end if;
 if operation<>'begin' or not v.listening then return false;end if;
 perform pg_advisory_xact_lock(31941,812);
 if exists(select 1 from gallery_internal.visits where room=v.room and instance=v.instance and voice_until>stamp and ticket<>lease)
 or (select count(*) from gallery_internal.visits where voice_until>stamp and ticket<>lease)>=6 then return false;end if;
 update gallery_internal.visits set voice_until=stamp+interval '15 seconds',last_packet=null where ticket=lease;return true;
end $$;
-- Audio bytes travel only through the edge service and private WebSockets.
create function public.gallery_voice_packet(lease uuid,encoded_length integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v gallery_internal.visits; targets text[]; stamp timestamptz:=clock_timestamp();cost bigint; budget_day date:=(now() at time zone 'UTC')::date;
begin
 select * into strict v from gallery_internal.visits where ticket=lease and actor=auth.uid() and listening and expires_at>stamp for update;
 if encoded_length not between 4 and 8540 or encoded_length is null or v.voice_until is null or v.voice_until<stamp or v.last_packet>stamp-interval '430 milliseconds' then return null;end if;
 update gallery_internal.visits set last_packet=stamp where ticket=lease;
 select coalesce(array_agg('voice:'||peer),'{}') into targets from gallery_internal.visits
 where room=v.room and instance=v.instance and ticket<>lease and listening and expires_at>stamp and actor is not null;
 cost:=(1024+encoded_length)*(1+cardinality(targets));
 insert into gallery_internal.voice_budget as b values(budget_day,1,cost) on conflict(day) do update
 set packets=b.packets+1,bytes=b.bytes+excluded.bytes where b.packets<10000 and b.bytes+excluded.bytes<=41943040;
 if not found then raise exception 'Se alcanzó el cupo diario de voz. El chat de texto sigue disponible.';end if;
 return jsonb_build_object('topics',targets,'nick',v.nick,'peer',v.peer);
end $$;
revoke all on function public.gallery_voice_packet(uuid,integer) from public,anon;
grant execute on function public.gallery_voice_packet(uuid,integer) to authenticated;
