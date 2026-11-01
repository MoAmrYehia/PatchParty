CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`host_hash` text NOT NULL,
	`read_hash` text NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
