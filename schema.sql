-- Core Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  plan       TEXT CHECK (plan IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Core User Table
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  full_name            TEXT NOT NULL,
  role                 TEXT CHECK (role IN ('employer', 'worker', 'admin')),
  org_id               UUID REFERENCES organizations(id),
  phone_number         TEXT,
  skills               TEXT[],           -- Array of skill tags (synced from skill_levels keys)
  skill_levels         JSONB DEFAULT '{}', -- e.g. {"plumbing": 4, "electrical": 2} — levels 1-5
  categories           TEXT[],           -- Array of job categories
  is_available         BOOLEAN DEFAULT TRUE,
  id_verified          BOOLEAN DEFAULT FALSE,
  average_rating       DECIMAL(3, 2) DEFAULT 0,
  completed_gigs_count INTEGER DEFAULT 0,
  total_gigs_count     INTEGER DEFAULT 0,
  track_record_score   DECIMAL(5, 2) DEFAULT 0,
  worker_confirmed     BOOLEAN DEFAULT FALSE,
  employer_confirmed   BOOLEAN DEFAULT FALSE,
  current_lat          DECIMAL(9, 6),
  current_lng          DECIMAL(9, 6),
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Postings
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      UUID REFERENCES users(id),
  org_id           UUID REFERENCES organizations(id),
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL,
  skills_required  TEXT[],
  budget_amount    DECIMAL(12, 2) NOT NULL,
  location_lat     DECIMAL(9, 6) NOT NULL,
  location_lng     DECIMAL(9, 6) NOT NULL,
  duration_days    INTEGER,              -- Job duration: 1 to 30 days
  status           TEXT CHECK (status IN ('open', 'filled', 'completed', 'cancelled')) DEFAULT 'open',
  is_urgent        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gigs (Active Job Instances)
CREATE TABLE IF NOT EXISTS gigs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID REFERENCES jobs(id),
  worker_id          UUID REFERENCES users(id),
  status             TEXT CHECK (status IN ('assigned', 'started', 'completed', 'disputed', 'paid')) DEFAULT 'assigned',
  clock_in_time      TIMESTAMP WITH TIME ZONE,
  clock_out_time     TIMESTAMP WITH TIME ZONE,
  escrow_status      TEXT CHECK (escrow_status IN ('pending', 'held', 'released', 'refunded')) DEFAULT 'pending',
  tracking_enabled   BOOLEAN DEFAULT FALSE,
  worker_confirmed   BOOLEAN DEFAULT FALSE,   -- Worker clicked "Job Complete"
  employer_confirmed BOOLEAN DEFAULT FALSE,   -- Employer clicked "Job Complete"
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Real-time Tracking Logs (Subject to POPIA 90-day purge)
CREATE TABLE IF NOT EXISTS tracking_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      UUID REFERENCES gigs(id),
  lat         DECIMAL(9, 6) NOT NULL,
  lng         DECIMAL(9, 6) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reviews and Reputation
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id      UUID REFERENCES gigs(id),
  reviewer_id UUID REFERENCES users(id),
  reviewee_id UUID REFERENCES users(id),
  rating      INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gig_id, reviewer_id)  -- One review per gig per reviewer
);

-- Escrow Transactions
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id           UUID REFERENCES gigs(id),
  amount           DECIMAL(12, 2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'payout', 'commission')),
  status           TEXT CHECK (status IN ('pending', 'completed', 'failed')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Long-term Contracts/Subscriptions (COMPANY-DRIVEN — employer offers, not worker)
CREATE TABLE IF NOT EXISTS contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id   UUID REFERENCES users(id),
  worker_id     UUID REFERENCES users(id),
  base_gig_id   UUID REFERENCES gigs(id),
  contract_type TEXT CHECK (contract_type IN ('subscription_month', 'fixed_term')),
  status        TEXT CHECK (status IN ('active', 'ended', 'paused')) DEFAULT 'active',
  monthly_rate  DECIMAL(12, 2),
  start_date    DATE,
  end_date      DATE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Push Notifications (for matching engine alerts)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  type        TEXT CHECK (type IN ('job_match', 'gig_assigned', 'escrow_held', 'job_complete', 'contract_offer', 'review_received')),
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Anonymized Tracking Summaries (for analytics after 90-day purge)
CREATE TABLE IF NOT EXISTS gig_tracking_summaries (
  gig_id             UUID PRIMARY KEY REFERENCES gigs(id),
  total_points       INTEGER,
  first_recorded_at  TIMESTAMP WITH TIME ZONE,
  last_recorded_at   TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_gigs_worker ON gigs(worker_id);
CREATE INDEX IF NOT EXISTS idx_gigs_job ON gigs(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_tracking_gig ON tracking_logs(gig_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
