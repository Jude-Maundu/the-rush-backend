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

create table if not exists public.crew_members (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    role text not null,
    "group" text not null check ("group" in ('cast', 'crew')),
    image text,
    slug text not null unique,
    bio text,
    created_at timestamptz not null default now()
);
alter table public.crew_members add column if not exists image_public_id text;
alter table public.crew_members add column if not exists image_storage text not null default 'cloudinary';
alter table public.crew_members add column if not exists image_storage_key text;

delete from public.crew_members as member
using (values
    ('Teddy Ngare', 'Director', 'crew', '/cast/Teddy.jpeg', 'teddy-ngare'),
    ('Felister Mwende', 'Producer', 'crew', '/cast/Felister.jpeg', 'felister-mwende'),
    ('Rita Njeri', 'Script writer', 'crew', '/cast/Ritah.jpeg', 'rita-njeri'),
    ('Serena Spechiozers', 'Director of photography', 'crew', '/cast/Serena.jpeg', 'serena-spechiozers'),
    ('Gift Kioko', 'Videographer', 'crew', '/cast/Gift.jpeg', 'gift-kioko'),
    ('Felix Ochari', 'Editor', 'crew', '/cast/Felix.jpeg', 'felix-ochari'),
    ('Daniel Gori', 'Sound', 'crew', '/cast/Daniel.jpeg', 'daniel-gori'),
    ('Dimitry Bifwoli', 'Main actor', 'cast', '/cast/Dimitry.jpeg', 'dimitry-bifwoli'),
    ('Evelyn Mwikali', 'Supporting actor', 'cast', '/cast/Evelyne.jpeg', 'evelyn-mwikali')
) as legacy(name, role, group_name, image, slug)
where member.name = legacy.name
    and member.role = legacy.role
    and member."group" = legacy.group_name
    and member.image = legacy.image
    and member.slug = legacy.slug
    and member.bio is null
    and member.image_public_id is null
    and member.image_storage_key is null;

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
create index if not exists reviews_movie_id_idx on public.reviews (movie_id);

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.reviews enable row level security;
alter table public.crew_members enable row level security;

drop policy if exists "Profiles can be read by their owner" on public.profiles;
create policy "Profiles can be read by their owner"
    on public.profiles for select to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "Movies are publicly readable" on public.movies;
create policy "Movies are publicly readable"
    on public.movies for select to anon, authenticated
    using (true);

drop policy if exists "Cast and crew are publicly readable" on public.crew_members;
create policy "Cast and crew are publicly readable"
    on public.crew_members for select to anon, authenticated
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
