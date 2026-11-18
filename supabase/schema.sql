create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    name text not null,
    role text not null default 'member' check (role in ('member', 'admin')),
    created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, name)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), new.email)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
    after insert on auth.users
    for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.movies (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    year integer not null,
    genre text not null,
    poster text not null,
    backdrop text,
    description text,
    trailer text,
    director text,
    duration text,
    "cast" text[] not null default '{}',
    created_at timestamptz not null default now()
);

create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    movie_id uuid references public.movies (id) on delete set null,
    rating integer not null check (rating between 1 and 5),
    body text not null check (char_length(body) between 1 and 500),
    created_at timestamptz not null default now()
);

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
create index if not exists reviews_movie_id_idx on public.reviews (movie_id);

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Profiles can be read by their owner" on public.profiles;
create policy "Profiles can be read by their owner"
    on public.profiles for select to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "Movies are publicly readable" on public.movies;
create policy "Movies are publicly readable"
    on public.movies for select to anon, authenticated
    using (true);

drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable"
    on public.reviews for select to anon, authenticated
    using (true);

drop policy if exists "Members can create their own reviews" on public.reviews;
create policy "Members can create their own reviews"
    on public.reviews for insert to authenticated
    with check ((select auth.uid()) = user_id);

-- Promote a trusted account by running:
-- update public.profiles set role = 'admin' where id = '<auth.users id>';
