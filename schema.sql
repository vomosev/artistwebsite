SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `session_data` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`session_id`),
  KEY `idx_sessions_expires_at` (`expires_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `artist_profile` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `artist_name` VARCHAR(160) NOT NULL,
  `headline` VARCHAR(255) NOT NULL,
  `introduction` TEXT NOT NULL,
  `biography` TEXT NOT NULL,
  `location` VARCHAR(180) DEFAULT NULL,
  `practice_statement` TEXT DEFAULT NULL,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `instagram_url` VARCHAR(2048) DEFAULT NULL,
  `website_url` VARCHAR(2048) DEFAULT NULL,
  `hero_image_url` VARCHAR(2048) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_artist_profile_singleton` CHECK (`id` = 1)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `artworks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `year` SMALLINT UNSIGNED DEFAULT NULL,
  `medium` VARCHAR(255) DEFAULT NULL,
  `dimensions` VARCHAR(255) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `image_url` VARCHAR(2048) NOT NULL,
  `alt_text` VARCHAR(500) DEFAULT NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `display_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_artworks_slug` (`slug`),
  KEY `idx_artworks_public_order` (`is_published`, `display_order`, `id`),
  KEY `idx_artworks_category` (`category`),
  KEY `idx_artworks_featured` (`is_featured`, `is_published`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `artist_profile` (
  `id`,
  `artist_name`,
  `headline`,
  `introduction`,
  `biography`,
  `location`,
  `practice_statement`,
  `contact_email`,
  `instagram_url`,
  `website_url`,
  `hero_image_url`
) VALUES (
  1,
  'Mara Voss',
  'Quiet studies of color, memory, and place.',
  'Mara Voss is a contemporary visual artist creating layered paintings and works on paper inspired by changing landscapes, domestic rituals, and the fragments of memory that connect them.',
  'Working between observation and abstraction, Mara builds each composition through translucent color, measured gesture, and repeated revision. Her work considers how familiar places are reshaped by time and how ordinary materials can hold emotional weight. Recent projects bring painting, drawing, and small sculptural studies into conversation, creating spaces that feel both intimate and expansive.',
  'Portland, Oregon',
  'My practice begins with collected impressions: a horizon glimpsed in passing, the geometry of a room, a faded photograph, or the color of late afternoon. I translate these fragments through slow accumulation, allowing traces of earlier decisions to remain visible. The finished works are less records of a particular place than invitations to notice how perception and memory continually remake one another.',
  'studio@example.com',
  NULL,
  'https://artistwebsite.geo-drops.com',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1800&q=85'
);

INSERT IGNORE INTO `artworks` (
  `title`,
  `slug`,
  `category`,
  `year`,
  `medium`,
  `dimensions`,
  `description`,
  `image_url`,
  `alt_text`,
  `is_published`,
  `is_featured`,
  `display_order`
) VALUES
(
  'After the Long Rain',
  'after-the-long-rain',
  'Painting',
  2025,
  'Oil and cold wax on linen',
  '122 × 152 cm',
  'A layered meditation on clearing weather, where muted earth tones give way to an open field of luminous blue.',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1600&q=85',
  'Abstract painting with layered blue, cream, and earthen tones',
  1,
  1,
  10
),
(
  'Held Light',
  'held-light',
  'Painting',
  2024,
  'Oil on linen',
  '91 × 76 cm',
  'Soft planes of color gather around a bright central passage, suggesting the sensation of light retained after sunset.',
  'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1600&q=85',
  'Abstract composition in warm yellow, coral, blue, and dark accents',
  1,
  0,
  20
),
(
  'Field Notes No. 7',
  'field-notes-no-7',
  'Works on Paper',
  2024,
  'Gouache, graphite, and pastel on paper',
  '56 × 42 cm',
  'One in an ongoing series of compact observations developed from walks, weather records, and remembered horizons.',
  'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1600&q=85',
  'Colorful geometric abstract work on paper',
  1,
  0,
  30
),
(
  'Near Distance',
  'near-distance',
  'Painting',
  2023,
  'Acrylic and mineral pigment on canvas',
  '102 × 102 cm',
  'Intersecting bands shift between foreground and horizon, holding nearness and distance in a deliberately unresolved balance.',
  'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1600&q=85',
  'Abstract painting with broad atmospheric bands of color',
  1,
  0,
  40
),
(
  'Small Monument',
  'small-monument',
  'Sculpture',
  2023,
  'Pigmented plaster, wood, and beeswax',
  '38 × 24 × 18 cm',
  'A modest architectural form assembled as a tribute to the marks, repairs, and surfaces encountered in everyday spaces.',
  'https://images.unsplash.com/photo-1544413660-299165566b1d?auto=format&fit=crop&w=1600&q=85',
  'Minimal sculptural form displayed against a neutral wall',
  1,
  0,
  50
),
(
  'Evening Index',
  'evening-index',
  'Works on Paper',
  2022,
  'Watercolor and colored pencil on cotton paper',
  '38 × 51 cm',
  'Repeated lines and transparent washes map subtle changes in atmosphere across the final hour of daylight.',
  'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1600&q=85',
  'Expressive abstract artwork with transparent washes and linear marks',
  1,
  0,
  60
);