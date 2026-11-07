-- Structured Media match-event social automation configuration.
-- Defaults preserve the legacy routing/VIP policy, but every destination starts disabled
-- until channel credentials, provider adapters and a separate dispatcher are verified.
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_social_automation_settings (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  is_enabled boolean NOT NULL DEFAULT false,
  fallback_first_match_when_no_vip_today boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  frontend_base_url text NOT NULL DEFAULT 'https://factsport.com'
    CHECK (frontend_base_url ~ '^https://'),
  images_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.media_social_automation_settings (singleton_id)
VALUES (1) ON CONFLICT (singleton_id) DO NOTHING;

INSERT INTO public.media_social_channels
  (channel_key, display_name, provider, account_label, is_enabled)
VALUES
  ('buf_x1', 'Buffer · X account 1', 'buffer', 'Legacy route: buf_x1', false),
  ('buf_x2', 'Buffer · X account 2', 'buffer', 'Legacy route: buf_x2', false),
  ('buf_fb1', 'Buffer · Facebook account 1', 'buffer', 'Legacy route: buf_fb1', false),
  ('buf_fb2', 'Buffer · Facebook account 2', 'buffer', 'Legacy route: buf_fb2', false),
  ('fb1', 'Meta · Facebook page 1', 'meta', 'Legacy route: fb1', false),
  ('fb2', 'Meta · Facebook page 2', 'meta', 'Legacy route: fb2', false),
  ('make1', 'Make · webhook 1', 'make', 'Legacy route: make1', false),
  ('make2', 'Make · webhook 2', 'make', 'Legacy route: make2', false),
  ('tg_general', 'Telegram · general channels', 'telegram', 'Legacy route: tg_general', false)
ON CONFLICT (channel_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_social_event_routes (
  event_key text NOT NULL CHECK (event_key IN (
    'goals', 'lineups', 'kickoff', 'fulltime', 'halftime',
    'var_overturn', 'penalty_awarded'
  )),
  channel_id uuid NOT NULL REFERENCES public.media_social_channels(id) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_key, channel_id)
);

-- Exact legacy SAFETY_MAP defaults. No route is activated merely by this seed:
-- channel records and the global automation switch are all disabled.
INSERT INTO public.media_social_event_routes (event_key, channel_id, is_enabled)
SELECT event.event_key, channel.id,
  CASE
    WHEN event.event_key = 'lineups' AND channel.channel_key IN ('buf_x1', 'fb1', 'make1') THEN true
    WHEN event.event_key IN ('goals', 'kickoff', 'fulltime') AND channel.channel_key IN ('fb1', 'make1') THEN true
    WHEN event.event_key IN ('halftime', 'var_overturn', 'penalty_awarded') AND channel.channel_key = 'fb1' THEN true
    ELSE false
  END
FROM (VALUES
  ('goals'), ('lineups'), ('kickoff'), ('fulltime'),
  ('halftime'), ('var_overturn'), ('penalty_awarded')
) AS event(event_key)
CROSS JOIN public.media_social_channels channel
WHERE channel.channel_key IN (
  'buf_x1', 'buf_x2', 'buf_fb1', 'buf_fb2',
  'fb1', 'fb2', 'make1', 'make2', 'tg_general'
)
ON CONFLICT (event_key, channel_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_social_event_templates (
  event_key text NOT NULL CHECK (event_key IN (
    'goals', 'lineups', 'kickoff', 'fulltime', 'halftime',
    'var_overturn', 'penalty_awarded'
  )),
  channel_id uuid NOT NULL REFERENCES public.media_social_channels(id) ON DELETE RESTRICT,
  template_text text NOT NULL CHECK (char_length(template_text) <= 10000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  PRIMARY KEY (event_key, channel_id)
);

CREATE TABLE IF NOT EXISTS public.media_social_vip_teams (
  normalized_name text PRIMARY KEY,
  display_name text NOT NULL,
  source text NOT NULL DEFAULT 'legacy_default'
    CHECK (source IN ('legacy_default', 'admin_added', 'admin_disabled')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.media_social_vip_teams (normalized_name, display_name)
SELECT lower(regexp_replace(trim(name), '\s+', ' ', 'g')), name
FROM (VALUES
  ('Arsenal'), ('Aston Villa'), ('Chelsea'), ('Everton'), ('Liverpool'),
  ('Manchester City'), ('Man City'), ('Manchester United'), ('Man Utd'),
  ('Newcastle United'), ('Tottenham Hotspur'), ('Spurs'), ('Real Madrid'),
  ('Barcelona'), ('Atletico Madrid'), ('Bayern Munich'), ('Borussia Dortmund'),
  ('Bayer Leverkusen'), ('Juventus'), ('AC Milan'), ('Inter Milan'), ('Napoli'),
  ('Paris Saint Germain'), ('PSG'), ('Marseille'), ('Lyon'), ('Argentina'),
  ('Brazil'), ('France'), ('England'), ('Spain'), ('Italy'), ('Germany'),
  ('Portugal'), ('Netherlands'), ('Belgium'), ('Uruguay'), ('Colombia'),
  ('USA'), ('Mexico'), ('Senegal'), ('Morocco'), ('Nigeria')
) AS teams(name)
ON CONFLICT (normalized_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media_social_vip_leagues (
  normalized_name text PRIMARY KEY,
  display_name text NOT NULL,
  source text NOT NULL DEFAULT 'legacy_default'
    CHECK (source IN ('legacy_default', 'admin_added', 'admin_disabled')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.media_social_vip_leagues (normalized_name, display_name)
SELECT lower(regexp_replace(trim(name), '\s+', ' ', 'g')), name
FROM (VALUES
  ('Premier League'), ('La Liga'), ('Bundesliga'), ('Serie A'), ('Ligue 1'),
  ('Champions League'), ('Europa League'), ('Europa Conference League'),
  ('FA Cup'), ('Carabao Cup'), ('Copa del Rey'), ('Coppa Italia'),
  ('Coupe de France'), ('DFB-Pokal'), ('World Cup'), ('Euros'),
  ('Copa America'), ('AFCON'), ('UEFA Nations League'),
  ('CONCACAF Nations League')
) AS leagues(name)
ON CONFLICT (normalized_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS media_social_event_routes_enabled_idx
  ON public.media_social_event_routes (event_key, is_enabled);
CREATE INDEX IF NOT EXISTS media_social_vip_teams_enabled_idx
  ON public.media_social_vip_teams (is_enabled, normalized_name);
CREATE INDEX IF NOT EXISTS media_social_vip_leagues_enabled_idx
  ON public.media_social_vip_leagues (is_enabled, normalized_name);

REVOKE ALL ON public.media_social_automation_settings,
  public.media_social_event_routes, public.media_social_event_templates,
  public.media_social_vip_teams, public.media_social_vip_leagues
FROM PUBLIC, factsport_v2_reader, factsport_v2_schedule_writer, factsport_v2_espn_writer;
GRANT SELECT, INSERT, UPDATE ON public.media_social_automation_settings,
  public.media_social_event_routes, public.media_social_event_templates,
  public.media_social_vip_teams, public.media_social_vip_leagues
TO factsport_v2_editorial_writer;

COMMIT;
