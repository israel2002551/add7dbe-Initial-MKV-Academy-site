-- Adds explicit chapter ordering for Course -> Chapters -> Lessons structure.

alter table public.lessons
add column if not exists chapter_order integer not null default 1;

update public.lessons
set chapter_order = 1
where chapter_order is null;
