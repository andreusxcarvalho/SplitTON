create table profiles (
  id uuid primary key references auth.users(id),  -- Supabase Auth UID
  email text unique not null,
  telegram_id bigint unique not null,             -- unique Telegram identifier
  created_at timestamptz default now()
);

create table friends (
  id bigint primary key generated always as identity,
  user_id uuid references profiles(id) on delete cascade,          -- owner of friendship
  friend_user_id uuid references profiles(id) on delete cascade,   -- actual friend
  nickname text not null,                                          -- name user assigns to friend
  created_at timestamptz default now(),
  constraint unique_user_friend unique(user_id, nickname)          -- prevent duplicate nicknames
);

create table transactions (
  id bigint primary key generated always as identity,
  creator_id uuid references profiles(id),     -- who created the transaction
  source_type text not null,                  -- 'image', 'audio', 'text'
  source_path text,                           -- path in Supabase Storage
  total_amount numeric(12,2) not null,
  description text,
  created_at timestamptz default now()
);

create table transaction_participants (
  id bigint primary key generated always as identity,
  transaction_id bigint references transactions(id) on delete cascade,
  payer_id uuid references profiles(id) not null,   -- who paid
  payee_id uuid references profiles(id) not null,   -- who owes payer
  amount numeric(12,2) not null,                    -- raw amount owed
  status text default 'pending',                    -- 'pending' | 'paid'
  paid_at timestamptz,                              -- timestamp when payment was completed
  created_at timestamptz default now()
);

create table transaction_items (
  id bigint primary key generated always as identity,
  participant_id bigint references transaction_participants(id) on delete cascade,
  item_name text not null,
  item_price numeric(12,2) not null,
  category text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table friends enable row level security;
alter table transactions enable row level security;
alter table transaction_participants enable row level security;
alter table transaction_items enable row level security;

-- Select own profile
create policy "select_own_profile" on profiles
for select using (id = auth.uid());

-- Update own profile
create policy "update_own_profile" on profiles
for update using (id = auth.uid());

-- Select only own friends
create policy "select_own_friends" on friends
for select using (user_id = auth.uid());

-- Insert a new friend for self
create policy "insert_own_friends" on friends
for insert with check (user_id = auth.uid());

-- Update own friends
create policy "update_own_friends" on friends
for update using (user_id = auth.uid());

-- Delete own friends
create policy "delete_own_friends" on friends
for delete using (user_id = auth.uid());

-- Select transactions if user is creator or payer/payee
create policy "select_transactions_if_participant" on transactions
for select using (
  creator_id = auth.uid() OR
  exists (
    select 1
    from transaction_participants tp
    where tp.transaction_id = transactions.id
      and (tp.payer_id = auth.uid() OR tp.payee_id = auth.uid())
  )
);

-- Insert transactions as self
create policy "insert_own_transactions" on transactions
for insert with check (creator_id = auth.uid());

-- Update transactions only if creator
create policy "update_own_transactions" on transactions
for update using (creator_id = auth.uid());

-- Delete transactions only if creator
create policy "delete_own_transactions" on transactions
for delete using (creator_id = auth.uid());

-- Select rows where user is payer or payee
create policy "select_participant_self" on transaction_participants
for select using (
  payer_id = auth.uid() OR payee_id = auth.uid()
);

-- Allow inserting participants if the user is the creator of the parent transaction
create policy "insert_participant_by_transaction_creator" on transaction_participants
for insert with check (
  exists (
    select 1
    from transactions t
    where t.id = transaction_participants.transaction_id
      and t.creator_id = auth.uid()
  )
);
