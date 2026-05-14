update auth.users
set encrypted_password = crypt('PlusTest123!', gen_salt('bf')),
    updated_at = now()
where email = 'plus@test.keystone.dev';

update auth.users
set encrypted_password = crypt('ProTest123!', gen_salt('bf')),
    updated_at = now()
where email = 'pro@test.keystone.dev';