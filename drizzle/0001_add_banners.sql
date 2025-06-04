CREATE TABLE IF NOT EXISTS "banners" (
  "id" varchar(30) PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "image_url" text NOT NULL,
  "link" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp DEFAULT current_timestamp
); 