CREATE TABLE champion_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  internal_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (internal_name, role)
);

CREATE INDEX idx_champion_roles_role ON champion_roles(role);

-- Enable RLS
ALTER TABLE champion_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champions_read" ON champion_roles FOR SELECT USING (true);
CREATE POLICY "champions_insert" ON champion_roles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "champions_update" ON champion_roles FOR UPDATE USING (auth.role() = 'authenticated');
