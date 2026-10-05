CREATE DATABASE IF NOT EXISTS spendly
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE spendly;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar ENUM('female', 'male') NOT NULL DEFAULT 'female',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  budget DECIMAL(12, 2) NOT NULL DEFAULT 0,
  income DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT '₹',
  last_login TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT chk_user_settings_budget CHECK (budget >= 0),
  CONSTRAINT chk_user_settings_income CHECK (income >= 0),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  `desc` VARCHAR(255) NOT NULL,
  amt DECIMAL(12, 2) NOT NULL,
  cat VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  notes TEXT NULL,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recur_freq ENUM('daily', 'weekly', 'monthly', 'yearly') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_expenses_amount CHECK (amt > 0),
  CONSTRAINT chk_expenses_recurring CHECK (
    (recurring = FALSE AND recur_freq IS NULL) OR
    (recurring = TRUE AND recur_freq IS NOT NULL)
  ),
  KEY idx_expenses_user_date (user_id, date, id),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS memories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  img MEDIUMTEXT NOT NULL,
  caption VARCHAR(255) NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_memories_user_date (user_id, date, id),
  CONSTRAINT fk_memories_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
